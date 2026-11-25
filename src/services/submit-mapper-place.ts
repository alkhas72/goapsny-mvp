import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessibilityStatus, RampType, ToiletAccessible, YesNoUnknown } from '../shared/index';
import { mapPlaceRow, type PublicPlace } from './places';
import {
  FACADE_MIME_TYPE,
  FACADE_STORAGE_BUCKET,
  SubmitPlaceError,
  classifySubmitError,
  facadeStoragePath,
  generatePlaceId,
  isPlaceId,
  parseRpcPlaceRow,
} from './submit-place';
import { isSupabaseConfigured } from './supabase';

/**
 * Путь картографа: полная карточка уходит на проверку.
 *
 * Вызывает `public.submit_mapper_place`. Первая версия функции — миграция
 * `20261123120000_mapper_pending_submission.sql` (12 параметров); миграция
 * `20261125090000_mapper_measures_amenities_coordinator.sql` добавила
 * сантиметры, туалет с фото и отметки, прежний набор параметров работает.
 * Сервер сам ставит moderation_status='pending', source, created_by и дату
 * осмотра; клиент передаёт только то, что картограф видел у входа.
 * Публикует карточку модератор — см. `services/moderation.ts`.
 */
export const SUBMIT_MAPPER_PLACE_RPC = 'submit_mapper_place';

/** Сколько фото туалета держит карточка (ограничение пути в базе). */
export const TOILET_PHOTOS_MAX = 2;

/** Пути фото туалета: сервер выводит их сам из числа фото, клиент обязан совпасть. */
export function toiletStoragePath(placeId: string, index: number): string {
  return index === 0 ? `${placeId}/toilet.jpg` : `${placeId}/toilet-${index + 1}.jpg`;
}

/** Кто дал число: прочитано по фото или введено человеком. */
export type MeasureSource = 'photo' | 'person';

export interface SubmitMapperPlaceInput {
  name: string;
  category: string;
  lat: number;
  lng: number;
  /** Фото фасада, уже приведённое к JPEG (utils/photo.ts). */
  photo: Blob;
  /** Оценку ставит человек у входа; серой она не бывает. */
  status: Exclude<AccessibilityStatus, 'gray'>;
  stepsCount: number | null;
  rampType: RampType | null;
  subtype: string | null;
  /** Есть ли ступень выше 5 см (граница по решению Алхаса 25.11, до того 7 см). */
  stepHigh: YesNoUnknown;
  /** Дверь шире 80 см. */
  doorWide: YesNoUnknown;

  // Всё ниже необязательно: карточки, отложенные на устройстве до 25.11,
  // этих полей не несут и уходят прежним набором параметров.
  /** Высота ступени, см (0–100). Замер предварительный. */
  stepHeightCm?: number | null;
  /** Ширина двери, см (30–500). Замер предварительный. */
  doorWidthCm?: number | null;
  stepHeightSource?: MeasureSource | null;
  doorWidthSource?: MeasureSource | null;
  toilet?: YesNoUnknown;
  toiletAccessible?: ToiletAccessible;
  /** До двух фото туалета, уже приведённые к JPEG. */
  toiletPhotos?: Blob[];
  toiletNote?: string | null;
  handWash?: YesNoUnknown;
  accessibleParking?: YesNoUnknown;
  elevator?: YesNoUnknown;
}

export interface SubmitMapperPlaceResult {
  placeId: string;
  storagePath: string;
  /** Строка, подтверждённая сервером: без неё успех не показывается. */
  place: PublicPlace;
  /** Сколько фото туалета легло в карточку (может быть меньше снятых). */
  toiletPhotosSaved: number;
}

export interface SubmitMapperPlaceOptions {
  supabase?: SupabaseClient;
  generateId?: () => string;
  /**
   * Повтор отложенной отправки с прежним идентификатором: фото могло уже
   * лежать на сервере с прошлой попытки. Тогда идём дальше — функция в базе
   * сама проверит, что файл на месте и принадлежит вызвавшему.
   */
  resume?: boolean;
}

/** Storage отвечает так, когда файл по этому пути уже есть. */
function isAlreadyUploaded(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { statusCode?: unknown; error?: unknown; message?: unknown };
  return (
    String(e.statusCode ?? '') === '409' ||
    e.error === 'Duplicate' ||
    (typeof e.message === 'string' && /already exists/i.test(e.message))
  );
}

async function removeOrphans(supabase: SupabaseClient, storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return;
  try {
    await supabase.storage.from(FACADE_STORAGE_BUCKET).remove(storagePaths);
  } catch {
    // Осиротевшие фото не должны подменять причину отказа.
  }
}

function known(value: YesNoUnknown | undefined): boolean {
  return value === 'yes' || value === 'no';
}

/** Несёт ли карточка то, что понимает только функция после миграции 25.11. */
function hasExtendedFacts(input: SubmitMapperPlaceInput, toiletPhotos: number): boolean {
  return (
    input.stepHeightCm != null ||
    input.doorWidthCm != null ||
    known(input.toilet) ||
    toiletPhotos > 0 ||
    !!input.toiletNote?.trim() ||
    known(input.handWash) ||
    known(input.accessibleParking) ||
    known(input.elevator)
  );
}

/** PostgREST отвечает так, когда функции с таким набором параметров в базе нет. */
function isUnknownSignature(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'PGRST202';
}

export async function submitMapperPlace(
  input: SubmitMapperPlaceInput,
  options: SubmitMapperPlaceOptions = {},
): Promise<SubmitMapperPlaceResult> {
  let supabase = options.supabase;
  if (!supabase) {
    if (!isSupabaseConfigured()) {
      throw new SubmitPlaceError(
        'not_configured',
        'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY',
      );
    }
    // Ленивый импорт держит общий клиент вне графа модульных тестов.
    const { getSupabaseClient } = await import('./supabase');
    supabase = getSupabaseClient();
  }

  const placeId = options.generateId ? options.generateId() : generatePlaceId();
  if (!isPlaceId(placeId)) {
    throw new SubmitPlaceError('unknown', `Generated place_id is not a valid UUID: ${placeId}`);
  }
  const storagePath = facadeStoragePath(placeId);

  // Пустое фото сервер не примет никогда: повторять такую отправку незачем.
  if (input.photo.size === 0) {
    throw new SubmitPlaceError('photo_unreadable', 'Facade photo has no bytes');
  }

  const uploadResult = await supabase.storage
    .from(FACADE_STORAGE_BUCKET)
    .upload(storagePath, input.photo, { contentType: FACADE_MIME_TYPE, upsert: false });
  const uploadError = (uploadResult as { error?: unknown }).error;
  if (uploadError && !(options.resume && isAlreadyUploaded(uploadError))) {
    throw new SubmitPlaceError(
      'missing_photo',
      `Failed to upload facade photo to ${storagePath}`,
      null,
      uploadError,
    );
  }

  // Фото туалета кладём по одному и по порядку: сервер ждёт toilet.jpg, затем
  // toilet-2.jpg. Не легло одно — остальные не шлём: карточка важнее.
  const wantsToilet = input.toilet === 'yes' ? (input.toiletPhotos ?? []).slice(0, TOILET_PHOTOS_MAX) : [];
  const toiletPaths: string[] = [];
  for (const [index, blob] of wantsToilet.entries()) {
    if (blob.size === 0) break;
    const path = toiletStoragePath(placeId, index);
    const result = await supabase.storage
      .from(FACADE_STORAGE_BUCKET)
      .upload(path, blob, { contentType: FACADE_MIME_TYPE, upsert: false });
    const error = (result as { error?: unknown }).error;
    if (error && !(options.resume && isAlreadyUploaded(error))) break;
    toiletPaths.push(path);
  }

  const legacyParams = {
    p_place_id: placeId,
    p_name: input.name,
    p_category: input.category,
    p_lat: input.lat,
    p_lng: input.lng,
    p_storage_path: storagePath,
    p_status: input.status,
    p_steps_count: input.stepsCount,
    p_ramp_type: input.rampType ?? 'none',
    p_subtype: input.subtype,
    p_step_high: input.stepHigh,
    p_door_wide: input.doorWide,
  };

  let toiletPhotosSaved = toiletPaths.length;
  let rpcResult: unknown;
  if (hasExtendedFacts(input, toiletPaths.length)) {
    const note = input.toiletNote?.trim() || null;
    rpcResult = await supabase.rpc(SUBMIT_MAPPER_PLACE_RPC, {
      ...legacyParams,
      p_step_height_cm: input.stepHeightCm ?? null,
      p_door_width_cm: input.doorWidthCm ?? null,
      p_step_height_source: input.stepHeightCm != null ? (input.stepHeightSource ?? 'person') : null,
      p_door_width_source: input.doorWidthCm != null ? (input.doorWidthSource ?? 'person') : null,
      p_toilet: input.toilet ?? 'unknown',
      p_toilet_accessible: input.toilet === 'yes' ? (input.toiletAccessible ?? 'unknown') : 'unknown',
      p_toilet_photos: toiletPaths.length,
      p_toilet_note: input.toilet === 'yes' ? note : null,
      p_hand_wash: input.handWash ?? 'unknown',
      p_accessible_parking: input.accessibleParking ?? 'unknown',
      p_elevator: input.elevator ?? 'unknown',
    });
    // База ещё не знает новых параметров (миграция 25.11 не применена):
    // карточка уходит прежним набором, чтобы объект не потерялся. Фото
    // туалета такая функция не привяжет, поэтому их снимаем.
    if (isUnknownSignature((rpcResult as { error?: unknown }).error)) {
      await removeOrphans(supabase, [...toiletPaths]);
      toiletPaths.length = 0;
      toiletPhotosSaved = 0;
      rpcResult = await supabase.rpc(SUBMIT_MAPPER_PLACE_RPC, legacyParams);
    }
  } else {
    rpcResult = await supabase.rpc(SUBMIT_MAPPER_PLACE_RPC, legacyParams);
  }

  const rpcError = (rpcResult as { error?: unknown }).error;
  if (rpcError) {
    await removeOrphans(supabase, [storagePath, ...toiletPaths]);
    throw classifySubmitError(rpcError);
  }

  const row = parseRpcPlaceRow((rpcResult as { data?: unknown }).data, placeId);
  if (!row) {
    await removeOrphans(supabase, [storagePath, ...toiletPaths]);
    throw new SubmitPlaceError('unknown', 'RPC completed without a place row');
  }

  return { placeId, storagePath, place: mapPlaceRow(row), toiletPhotosSaved };
}
