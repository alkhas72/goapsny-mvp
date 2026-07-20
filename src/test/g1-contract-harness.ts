import type { SupabaseClient } from '@supabase/supabase-js';

export const PUBLIC_USER_ROLE = 'public_user';
export const PUBLIC_SESSION_KEY = 'goapsny_public_session';
export const PUBLIC_SUBMIT_STATUS = 'gray' as const;
export const PUBLIC_SUBMIT_SOURCE = 'public' as const;
export const PUBLIC_SUBMIT_MODERATION_STATUS = 'pending' as const;
export const PHOTO_BUCKET = 'place-photos';

export interface PublicUserSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; role: string };
}

export interface PublicPlacePayload {
  name: string;
  category: string;
  lat: number;
  lng: number;
  status: 'gray';
  source: 'public';
  moderation_status: 'pending';
  facade_path: string;
}

export function buildFacadeStoragePath(placeId: string): string {
  return `${placeId}/facade.jpg`;
}

export async function requestEmailOtp(
  client: SupabaseClient,
  email: string,
): Promise<void> {
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(
  client: SupabaseClient,
  email: string,
  token: string,
): Promise<{ session: PublicUserSession; user: { id: string; role: string } }> {
  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error || !data?.session) {
    throw error ?? new Error('missing session after OTP verification');
  }
  const session = data.session as PublicUserSession;
  persistPublicUserSession(session);
  return { session, user: data.user as { id: string; role: string } };
}

export function persistPublicUserSession(session: PublicUserSession): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PUBLIC_SESSION_KEY, JSON.stringify(session));
}

export function loadPersistedPublicUserSession(): PublicUserSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(PUBLIC_SESSION_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as PublicUserSession;
}

export async function restorePublicUserSession(
  client: SupabaseClient,
): Promise<PublicUserSession | null> {
  const session = loadPersistedPublicUserSession();
  if (!session) return null;
  const { error } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;
  return session;
}

export async function submitPublicPlace(
  client: SupabaseClient,
  place: Omit<PublicPlacePayload, 'status' | 'source' | 'moderation_status'>,
): Promise<{ place_id: string }> {
  const payload: PublicPlacePayload = {
    name: place.name,
    category: place.category,
    lat: place.lat,
    lng: place.lng,
    status: PUBLIC_SUBMIT_STATUS,
    source: PUBLIC_SUBMIT_SOURCE,
    moderation_status: PUBLIC_SUBMIT_MODERATION_STATUS,
    facade_path: place.facade_path,
  };
  const { data, error } = await client.rpc('submit_public_place', payload);
  if (error) throw error;
  return data as { place_id: string };
}

export async function uploadFacadePhoto(
  client: SupabaseClient,
  placeId: string,
  file: Blob,
): Promise<{ path: string }> {
  const path = buildFacadeStoragePath(placeId);
  const { data, error } = await client.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return data as { path: string };
}

export async function fetchAnonymousPublishedPlace(
  client: SupabaseClient,
  placeId: string,
): Promise<{ id: string; status: string; moderation_status: string } | null> {
  const { data, error } = await client
    .from('places')
    .select('id,status,moderation_status')
    .eq('id', placeId)
    .eq('moderation_status', 'published')
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; status: string; moderation_status: string } | null;
}
