import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessibilityStatus, RampType, YesNoUnknown } from '../shared/index';
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
 * Вызывает `public.submit_mapper_place` (миграция
 * `supabase/migrations/20261123120000_mapper_pending_submission.sql`).
 * Сервер сам ставит moderation_status='pending', source, created_by и дату
 * осмотра; клиент передаёт только то, что картограф видел у входа.
 * Публикует карточку модератор — см. `services/moderation.ts`.
 */
export const SUBMIT_MAPPER_PLACE_RPC = 'submit_mapper_place';

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
  /** Есть ли ступень выше 7 см. */
  stepHigh: YesNoUnknown;
  /** Дверь шире 80 см. */
  doorWide: YesNoUnknown;
}

export interface SubmitMapperPlaceResult {
  placeId: string;
  storagePath: string;
  /** Строка, подтверждённая сервером: без неё успех не показывается. */
  place: PublicPlace;
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

async function removeOrphan(supabase: SupabaseClient, storagePath: string): Promise<void> {
  try {
    await supabase.storage.from(FACADE_STORAGE_BUCKET).remove([storagePath]);
  } catch {
    // Осиротевший фасад не должен подменять причину отказа.
  }
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

  const rpcResult = await supabase.rpc(SUBMIT_MAPPER_PLACE_RPC, {
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
  });

  const rpcError = (rpcResult as { error?: unknown }).error;
  if (rpcError) {
    await removeOrphan(supabase, storagePath);
    throw classifySubmitError(rpcError);
  }

  const row = parseRpcPlaceRow((rpcResult as { data?: unknown }).data, placeId);
  if (!row) {
    await removeOrphan(supabase, storagePath);
    throw new SubmitPlaceError('unknown', 'RPC completed without a place row');
  }

  return { placeId, storagePath, place: mapPlaceRow(row) };
}
