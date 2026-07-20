import type { SupabaseClient } from '@supabase/supabase-js';
import { mapPlaceRow, type PlaceRow, type SubmittedPlaceSnapshot } from './places';
import { isSupabaseConfigured } from './supabase';

/**
 * Public place submission service.
 *
 * Calls the hardened PostgREST RPC `public.submit_public_place` (defined in
 * migration `supabase/migrations/20260715120000_submit_public_place_rls_rpc.sql`,
 * owned by T2-Z) with EXACTLY the typed inputs the server accepts and nothing
 * the client must not be able to set (role/creator/status/moderation/source/
 * details/audit fields are hardcoded server-side). The exact signature is:
 *
 *   submit_public_place(
 *     p_place_id      uuid,
 *     p_name          text,
 *     p_category      text,
 *     p_lat           double precision,
 *     p_lng           double precision,
 *     p_storage_path  text
 *   ) returns public.places
 *
 * Do not widen this signature without updating the migration and the backend
 * contract. The facade photo path is the canonical `{place_id}/facade.jpg`
 * revalidated by the RPC.
 */

/** Private Storage bucket for place photos. */
export const FACADE_STORAGE_BUCKET = 'place-photos';

/** Exact facade object filename enforced by both the Storage policy and the RPC. */
export const FACADE_PHOTO_FILENAME = 'facade.jpg';

/** The only MIME type the bucket accepts (10 MiB `place-photos`, `image/jpeg`). */
export const FACADE_MIME_TYPE = 'image/jpeg';

/** Exact PostgREST function name. */
export const SUBMIT_PUBLIC_PLACE_RPC = 'submit_public_place';

/** Input the public PWA collects for a single preliminary gray submission. */
export interface SubmitPublicPlaceInput {
  /** Trimmed non-empty display name (server trims and rejects empty). */
  name: string;
  /** Active `categories.slug` (server rejects inactive/unknown). */
  category: string;
  /** Selected latitude in [-90, 90]; NaN/Infinity rejected. */
  lat: number;
  /** Selected longitude in [-180, 180]; NaN/Infinity rejected. */
  lng: number;
  /** Facade photo bytes (jpeg). Uploaded to `{place_id}/facade.jpg`. */
  photo: Blob;
}

/** Result of a successful submission. */
export interface SubmitPublicPlaceResult {
  /** The caller-generated UUID sent as `p_place_id`. */
  placeId: string;
  /** The exact `{place_id}/facade.jpg` path the RPC revalidated and indexed. */
  storagePath: string;
  /** Server row mapped for immediate map update; present only when RPC returned a row. */
  place?: ReturnType<typeof mapPlaceRow>;
  /** Echo of the confirmed form fields for immediate map pin rendering. */
  snapshot: SubmittedPlaceSnapshot;
}

/** Injection seam so unit tests do not touch the shared module-level client. */
export interface SubmitPublicPlaceOptions {
  /** Explicit client (tests). Falls back to the shared configured client. */
  supabase?: SupabaseClient;
  /** Deterministic UUID for tests; defaults to `crypto.randomUUID()`. */
  generateId?: () => string;
}

/** Stable error categories for deterministic UI feedback. */
export type SubmitPlaceErrorKind =
  /** Supabase env vars are missing (no live client available). */
  | 'not_configured'
  /** The facade upload failed before the RPC could run. */
  | 'missing_photo'
  /** `42501` — no auth session. */
  | 'auth_required'
  /** `42501` — authenticated but no `profiles` row. */
  | 'profile_required'
  /** `42501` — caller is not an active `public_user`. */
  | 'role_required'
  /** `23502` — name missing/empty after trim. */
  | 'name_required'
  /** `23503` — inactive or unknown category slug. */
  | 'category_invalid'
  /** `23503` — the owned facade Storage object is missing/not owned. */
  | 'facade_object_missing'
  /** `23505` — this contributor already used their one submission. */
  | 'already_submitted'
  /** `23505` — the generated `place_id` already exists. */
  | 'place_id_reused'
  /** `23505` — the facade path is already indexed by another photo. */
  | 'facade_reused'
  /** `22P02` — coordinates are non-finite or out of bounds. */
  | 'coordinates_invalid'
  /** `22P02` — storage_path does not equal `{place_id}/facade.jpg`. */
  | 'storage_path_invalid'
  /** Anything not covered above (network, unexpected Postgres code/text). */
  | 'unknown';

/** Deterministic error thrown by {@link submitPublicPlace}. */
export class SubmitPlaceError extends Error {
  readonly kind: SubmitPlaceErrorKind;
  readonly code: string | null;
  readonly cause: unknown;
  constructor(kind: SubmitPlaceErrorKind, message: string, code: string | null = null, cause: unknown = null) {
    super(message);
    this.name = 'SubmitPlaceError';
    this.kind = kind;
    this.code = code;
    this.cause = cause;
  }
}

/** Build the canonical facade path the Storage policy and RPC both require. */
export function facadeStoragePath(placeId: string): string {
  return `${placeId}/${FACADE_PHOTO_FILENAME}`;
}

/** Generate a fresh per-place UUID (first photo-path segment, not the user id). */
export function generatePlaceId(): string {
  return crypto.randomUUID();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** True for a canonical lowercase UUID — the shape enforced by the Storage policy. */
export function isPlaceId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

type RpcErrorLike = { code?: unknown; message?: unknown } | null | undefined;

/** RPC must return the inserted `places` row; empty/mismatched data is a failed submit. */
export function parseRpcPlaceRow(data: unknown, expectedPlaceId: string): PlaceRow | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (row.id !== expectedPlaceId) return null;
  if (typeof row.name !== 'string' || typeof row.category !== 'string') return null;
  if (typeof row.lat !== 'number' || typeof row.lng !== 'number') return null;
  if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return null;
  return row as unknown as PlaceRow;
}

/**
 * Map a raw Supabase/PostgREST error to a stable {@link SubmitPlaceErrorKind}.
 *
 * The RPC raises deterministic messages + SQLSTATE codes; we match on the
 * message first (stable, human-authored) and fall back to the code for any
 * message drift. Unknown shapes collapse to `unknown` so the UI never silently
 * mislabels a failure.
 */
export function classifySubmitError(raw: unknown): SubmitPlaceError {
  const err = (raw && typeof raw === 'object' ? raw : {}) as RpcErrorLike;
  const code = typeof err?.code === 'string' && err.code ? err.code : null;
  const message = typeof err?.message === 'string' ? err.message : '';

  // Prefer the deterministic server message; fall back to SQLSTATE.
  if (message.includes('authentication required')) {
    return new SubmitPlaceError('auth_required', message || 'Authentication required', code, raw);
  }
  if (message.includes('profile not found')) {
    return new SubmitPlaceError('profile_required', message || 'Profile not found', code, raw);
  }
  if (message.includes('caller must be public_user')) {
    return new SubmitPlaceError('role_required', message || 'Caller must be public_user', code, raw);
  }
  if (message.includes('name is required')) {
    return new SubmitPlaceError('name_required', message || 'Name is required', code, raw);
  }
  if (message.includes('inactive or unknown category')) {
    return new SubmitPlaceError('category_invalid', message || 'Inactive or unknown category', code, raw);
  }
  if (message.includes('owned facade object not found')) {
    return new SubmitPlaceError('facade_object_missing', message || 'Owned facade object not found', code, raw);
  }
  if (message.includes('public submission already used')) {
    return new SubmitPlaceError('already_submitted', message || 'Public submission already used', code, raw);
  }
  if (message.includes('place_id already used')) {
    return new SubmitPlaceError('place_id_reused', message || 'place_id already used', code, raw);
  }
  if (message.includes('facade already indexed')) {
    return new SubmitPlaceError('facade_reused', message || 'facade already indexed', code, raw);
  }
  if (message.includes('invalid coordinates')) {
    return new SubmitPlaceError('coordinates_invalid', message || 'Invalid coordinates', code, raw);
  }
  if (message.includes('storage_path must equal')) {
    return new SubmitPlaceError('storage_path_invalid', message || 'storage_path must equal {place_id}/facade.jpg', code, raw);
  }

  // SQLSTATE fallback when the message is absent or drifted.
  switch (code) {
    case '42501':
      return new SubmitPlaceError('role_required', message || 'Authorization error', code, raw);
    case '23502':
      return new SubmitPlaceError('name_required', message || 'Name is required', code, raw);
    case '23503':
      return new SubmitPlaceError('category_invalid', message || 'Category or referenced object missing', code, raw);
    case '23505':
      return new SubmitPlaceError('already_submitted', message || 'Submission already used', code, raw);
    case '22P02':
      return new SubmitPlaceError('coordinates_invalid', message || 'Invalid value', code, raw);
    default:
      return new SubmitPlaceError('unknown', message || 'Submission failed', code, raw);
  }
}

/**
 * Submit one preliminary gray place as an authenticated `public_user`.
 *
 * Flow: generate a UUID place id → upload facade bytes to
 * `place-photos/{place_id}/facade.jpg` → call `submit_public_place` with the
 * exact typed signature. Any failure is mapped to a {@link SubmitPlaceError}
 * so callers can branch deterministically.
 */
export async function submitPublicPlace(
  input: SubmitPublicPlaceInput,
  options: SubmitPublicPlaceOptions = {},
): Promise<SubmitPublicPlaceResult> {
  // Resolve the client without constructing the shared one in tests.
  const supabase = options.supabase ?? (isSupabaseConfigured() ? undefined : null);
  if (supabase === null) {
    throw new SubmitPlaceError(
      'not_configured',
      'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY',
    );
  }
  if (supabase === undefined) {
    // Lazy import keeps the module-level client out of the unit-test graph.
    const { getSupabaseClient } = await import('./supabase');
    return submitPublicPlace(input, { ...options, supabase: getSupabaseClient() });
  }

  const placeId = options.generateId ? options.generateId() : generatePlaceId();
  if (!isPlaceId(placeId)) {
    // Defensive: the generated id must satisfy the Storage path regex.
    throw new SubmitPlaceError('unknown', `Generated place_id is not a valid UUID: ${placeId}`);
  }
  const storagePath = facadeStoragePath(placeId);

  // 1) Upload the facade object to the exact path the RPC will revalidate.
  //    No upsert: a stale object must not be silently reused.
  const uploadResult = await supabase.storage
    .from(FACADE_STORAGE_BUCKET)
    .upload(storagePath, input.photo, { contentType: FACADE_MIME_TYPE, upsert: false });

  const uploadError = (uploadResult as { error?: unknown }).error;
  if (uploadError) {
    throw new SubmitPlaceError(
      'missing_photo',
      `Failed to upload facade photo to ${storagePath}`,
      null,
      uploadError,
    );
  }

  // 2) Call the RPC with the EXACT typed signature; the server hardcodes every
  //    other field (status/moderation/source/details/created_by/photo kind).
  const rpcResult = await supabase.rpc(SUBMIT_PUBLIC_PLACE_RPC, {
    p_place_id: placeId,
    p_name: input.name,
    p_category: input.category,
    p_lat: input.lat,
    p_lng: input.lng,
    p_storage_path: storagePath,
  });

  const rpcError = (rpcResult as { error?: unknown }).error;
  if (rpcError) {
    // Фасад уже в бакете, но записи о нём не появится — без уборки он останется
    // там навсегда. Миграция 20260715120000 специально даёт public_user право
    // удалить собственный неиспользуемый фасад
    // (place_photos_storage_delete_public_user_unreferenced).
    // Сбой самой уборки глушим: подменять им причину отказа нельзя.
    try {
      await supabase.storage.from(FACADE_STORAGE_BUCKET).remove([storagePath]);
    } catch {
      // Осиротевший объект переживёт эту попытку; исходная ошибка важнее.
    }
    throw classifySubmitError(rpcError);
  }

  const rpcData = (rpcResult as { data?: unknown }).data;
  const insertedRow = parseRpcPlaceRow(rpcData, placeId);
  if (!insertedRow) {
    // DG-3: без подтверждённой строки в places успех рисовать нельзя — иначе
    // отказ RPC (лимит, RLS, сеть) может выглядеть как «добавлено».
    try {
      await supabase.storage.from(FACADE_STORAGE_BUCKET).remove([storagePath]);
    } catch {
      // Осиротевший фасад не должен подменять причину отказа.
    }
    throw new SubmitPlaceError(
      'unknown',
      'RPC completed without a place row',
      null,
      rpcData ?? null,
    );
  }

  return {
    placeId,
    storagePath,
    place: mapPlaceRow(insertedRow),
    snapshot: {
      placeId,
      name: input.name,
      category: input.category,
      lat: input.lat,
      lng: input.lng,
    },
  };
}
