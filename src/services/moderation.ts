import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessibilityStatus, YesNoUnknown } from '../shared/index';
import { PHOTO_COLUMNS, PLACE_COLUMNS, mapPlaceRow, type PlaceRow, type PublicPlace } from './places';
import { getSupabaseClient } from './supabase';

/**
 * Проверка карточек картографов.
 *
 * Новых серверных объектов здесь нет: admin/owner уже читает все строки
 * places/photos (политики 0001) и меняет moderation_status обычным UPDATE
 * (замок places_lock_moderation_status пропускает только admin/owner).
 * Автор читает собственные подачи по политике places_read_published.
 */

export type ModerationStatus = PlaceRow['moderation_status'];

/** Кто вошёл: роль решает, показывать ли очередь проверки. */
export interface MapperAccount {
  id: string;
  role: string;
  karma: number;
  karmaStatus: string;
}

export interface MySubmission {
  id: string;
  name: string;
  category: string;
  status: AccessibilityStatus;
  moderationStatus: ModerationStatus;
  createdAt: string;
}

/** То, что картограф отметил у входа и что не легло в отдельные колонки. */
export interface MapperFacts {
  subtype: string | null;
  stepHigh: YesNoUnknown;
  doorWide: YesNoUnknown;
  /** Что волонтёр написал о туалете; пусто — ничего. */
  toiletNote: string | null;
  handWash: YesNoUnknown;
  accessibleParking: YesNoUnknown;
  elevator: YesNoUnknown;
}

export interface ModerationCard {
  place: PublicPlace;
  facts: MapperFacts;
  photoUrl: string | null;
  /** Фото туалета, если волонтёр их снял (до двух). */
  toiletPhotoUrls: string[];
}

export type ModerationDecision = 'published' | 'hidden';

export const MODERATION_QUEUE_LIMIT = 50;
export const MY_SUBMISSIONS_LIMIT = 50;

export function canModerate(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'owner';
}

const YES_NO_UNKNOWN: readonly string[] = ['yes', 'no', 'unknown'];

function yesNoUnknown(value: unknown): YesNoUnknown {
  return typeof value === 'string' && YES_NO_UNKNOWN.includes(value) ? (value as YesNoUnknown) : 'unknown';
}

/** Достаёт ответы картографа из details.mapper; мусор превращается в «не знаю». */
export function mapperFactsFromDetails(details: unknown): MapperFacts {
  const mapper =
    details && typeof details === 'object' && 'mapper' in details
      ? ((details as { mapper?: unknown }).mapper as Record<string, unknown> | null)
      : null;
  const subtype = mapper && typeof mapper.subtype === 'string' ? mapper.subtype.trim() : '';
  const toiletNote = mapper && typeof mapper.toilet_note === 'string' ? mapper.toilet_note.trim() : '';
  return {
    subtype: subtype || null,
    stepHigh: yesNoUnknown(mapper?.step_high),
    doorWide: yesNoUnknown(mapper?.door_wide),
    toiletNote: toiletNote || null,
    handWash: yesNoUnknown(mapper?.hand_wash),
    accessibleParking: yesNoUnknown(mapper?.accessible_parking),
    elevator: yesNoUnknown(mapper?.elevator),
  };
}

function fail(prefix: string, error: { message?: string } | null): Error {
  return new Error(error?.message ? `${prefix}: ${error.message}` : prefix);
}

/** Профиль вошедшего человека; null — никто не вошёл или профиля нет. */
export async function fetchMapperAccount(
  supabase: SupabaseClient = getSupabaseClient(),
): Promise<MapperAccount | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,role,karma,karma_status')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw fail('Не удалось прочитать профиль', error);
  if (!data) return null;
  return {
    id: data.id as string,
    role: data.role as string,
    karma: (data.karma as number | null) ?? 0,
    karmaStatus: (data.karma_status as string | null) ?? 'pedestrian',
  };
}

/** Собственные подачи человека, новые сверху, с состоянием проверки. */
export async function fetchMySubmissions(
  userId: string,
  supabase: SupabaseClient = getSupabaseClient(),
): Promise<MySubmission[]> {
  const { data, error } = await supabase
    .from('places')
    .select('id,name,category,status,moderation_status,created_at')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(MY_SUBMISSIONS_LIMIT);
  if (error) throw fail('Не удалось загрузить ваши объекты', error);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null)?.trim() || 'Без названия',
    category: row.category as string,
    status: row.status as AccessibilityStatus,
    moderationStatus: row.moderation_status as ModerationStatus,
    createdAt: row.created_at as string,
  }));
}

/** Очередь проверки: старые сверху, чтобы никто не ждал дольше остальных. */
export async function fetchModerationQueue(
  supabase: SupabaseClient = getSupabaseClient(),
): Promise<ModerationCard[]> {
  const { data: rows, error } = await supabase
    .from('places')
    .select(PLACE_COLUMNS)
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(MODERATION_QUEUE_LIMIT);
  if (error) throw fail('Не удалось загрузить очередь проверки', error);

  const placeRows = (rows ?? []) as unknown as PlaceRow[];
  if (placeRows.length === 0) return [];

  const { data: photos, error: photosError } = await supabase
    .from('photos')
    .select(PHOTO_COLUMNS)
    .in(
      'place_id',
      placeRows.map((row) => row.id),
    )
    .in('kind', ['facade', 'toilet']);
  if (photosError) throw fail('Не удалось загрузить фото очереди', photosError);

  const pathByPlace = new Map<string, string>();
  const toiletByPlace = new Map<string, string[]>();
  for (const photo of (photos ?? []) as { place_id: string; storage_path: string; kind?: string }[]) {
    if (photo.kind === 'toilet') {
      toiletByPlace.set(photo.place_id, [...(toiletByPlace.get(photo.place_id) ?? []), photo.storage_path]);
    } else if (!pathByPlace.has(photo.place_id)) {
      pathByPlace.set(photo.place_id, photo.storage_path);
    }
  }

  const sign = async (path: string): Promise<string | null> => {
    try {
      const { data: signed } = await supabase.storage.from('place-photos').createSignedUrl(path, 600);
      return signed?.signedUrl ?? null;
    } catch {
      return null;
    }
  };

  return Promise.all(
    placeRows.map(async (row) => {
      const path = pathByPlace.get(row.id);
      const photoUrl = path ? await sign(path) : null;
      // toilet.jpg раньше toilet-2.jpg: порядок, в котором их снимали.
      const toiletPaths = (toiletByPlace.get(row.id) ?? []).sort((a, b) => a.length - b.length);
      const toiletPhotoUrls = (await Promise.all(toiletPaths.map(sign))).filter((u): u is string => !!u);
      return {
        place: mapPlaceRow(row, photoUrl ?? undefined),
        facts: mapperFactsFromDetails(row.details),
        photoUrl,
        toiletPhotoUrls,
      };
    }),
  );
}

/**
 * Решение модератора. Условие `moderation_status = pending` защищает от двойного
 * нажатия и от гонки двух модераторов: вторая попытка не найдёт строку.
 */
export async function moderatePlace(
  placeId: string,
  decision: ModerationDecision,
  supabase: SupabaseClient = getSupabaseClient(),
): Promise<void> {
  const { data, error } = await supabase
    .from('places')
    .update({ moderation_status: decision })
    .eq('id', placeId)
    .eq('moderation_status', 'pending')
    .select('id');
  if (error) throw fail('Не удалось сохранить решение', error);
  if (!data || data.length === 0) {
    throw new Error('Карточка уже обработана или у вас нет прав на проверку');
  }
}
