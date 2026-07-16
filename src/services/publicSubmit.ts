import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export const FACADE_FILENAME = 'facade.jpg';

export interface PublicSubmitInput {
  placeId: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
}

export interface PublicSubmitWithPhotoInput extends PublicSubmitInput {
  photoFile: File;
}

export interface PublicSubmitResult {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  status: 'gray';
  moderationStatus: 'published';
  source: 'public';
}

export function createPlaceId(): string {
  return crypto.randomUUID();
}

export function buildFacadeStoragePath(placeId: string): string {
  return `${placeId}/${FACADE_FILENAME}`;
}

export async function uploadFacadePhoto(placeId: string, file: File): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }
  const supabase = getSupabaseClient();
  const path = buildFacadeStoragePath(placeId);
  const { error } = await supabase.storage.from('place-photos').upload(path, file, {
    upsert: false,
    contentType: 'image/jpeg',
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function cleanupOrphanFacade(placeId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  const path = buildFacadeStoragePath(placeId);
  await supabase.storage.from('place-photos').remove([path]);
}

export async function submitPublicPlace(input: PublicSubmitInput): Promise<PublicSubmitResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  const supabase = getSupabaseClient();
  const storagePath = buildFacadeStoragePath(input.placeId);
  const { data, error } = await supabase.rpc('submit_public_place', {
    p_place_id: input.placeId,
    p_name: input.name.trim(),
    p_category: input.category,
    p_lat: input.lat,
    p_lng: input.lng,
    p_storage_path: storagePath,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    name: data.name,
    category: data.category,
    lat: data.lat,
    lng: data.lng,
    status: 'gray',
    moderationStatus: 'published',
    source: 'public',
  };
}

export async function submitPublicPlaceWithPhoto(
  input: PublicSubmitWithPhotoInput,
): Promise<PublicSubmitResult> {
  await uploadFacadePhoto(input.placeId, input.photoFile);
  try {
    return await submitPublicPlace(input);
  } catch (error) {
    await cleanupOrphanFacade(input.placeId);
    throw error;
  }
}
