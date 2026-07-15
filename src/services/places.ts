import type { AccessibilityStatus, RampType, ToiletAccessible, YesNoUnknown } from '../shared/index';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export const PLACE_COLUMNS =
  'id,name,category,lat,lng,status,steps_count,step_height_cm,ramp_type,door_width_cm,entrance_notes,toilet_exists,toilet_accessible,parking,comment,osm_tags,details,moderation_status,source,created_by,created_at,updated_at';

/** Explicit photo metadata fields for anon read (published parents only). */
export const PHOTO_COLUMNS = 'id,place_id,storage_path,kind,created_at';

export const WELCOME_STORAGE_KEY = 'goapsny_welcome_seen_v1';

export interface PlaceDetailsV1 {
  schema_version?: number;
  address?: string;
  elevator?: 'yes' | 'no' | 'unknown';
  verification?: {
    verified_at?: string;
    verified_by_role?: string;
  };
  external_links?: {
    yandex?: string;
    google?: string;
    apple?: string;
    osm?: string;
  };
}

export interface PlaceRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  status: AccessibilityStatus;
  steps_count: number | null;
  step_height_cm: number | null;
  ramp_type: RampType;
  door_width_cm: number | null;
  entrance_notes: string | null;
  toilet_exists: YesNoUnknown;
  toilet_accessible: ToiletAccessible;
  parking: YesNoUnknown;
  comment: string | null;
  osm_tags: Record<string, string>;
  details: PlaceDetailsV1;
  moderation_status: 'published' | 'pending' | 'hidden';
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicPlace {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  status: AccessibilityStatus;
  stepsCount: number | null;
  stepHeightCm: number | null;
  rampType: RampType;
  doorWidthCm: number | null;
  entranceNotes: string | null;
  toiletExists: YesNoUnknown;
  toiletAccessible: ToiletAccessible;
  parking: YesNoUnknown;
  comment: string | null;
  osmTags: Record<string, string>;
  details: PlaceDetailsV1;
  moderationStatus: PlaceRow['moderation_status'];
  source: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  facadePhotoUrl?: string | null;
  facadePhotoError?: boolean;
}

export type StatusFilter = AccessibilityStatus | 'all';

export interface PlaceFilters {
  categories: string[];
  status: StatusFilter;
  query: string;
}

export function hasSeenWelcome(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(WELCOME_STORAGE_KEY) === 'true';
}

export function markWelcomeSeen(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
}

export function mapPlaceRow(row: PlaceRow, facadePhotoUrl?: string | null): PublicPlace {
  const details = (row.details ?? { schema_version: 1 }) as PlaceDetailsV1;
  return {
    id: row.id,
    name: row.name?.trim() || 'Без названия',
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    stepsCount: row.steps_count,
    stepHeightCm: row.step_height_cm,
    rampType: row.ramp_type,
    doorWidthCm: row.door_width_cm,
    entranceNotes: row.entrance_notes,
    toiletExists: row.toilet_exists,
    toiletAccessible: row.toilet_accessible,
    parking: row.parking,
    comment: row.comment,
    osmTags: row.osm_tags ?? {},
    details: {
      schema_version: details.schema_version ?? 1,
      address: details.address,
      elevator: details.elevator,
      verification: details.verification,
      external_links: details.external_links,
    },
    moderationStatus: row.moderation_status,
    source: row.source,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    facadePhotoUrl: facadePhotoUrl ?? null,
  };
}

export function isPartialPlace(place: PublicPlace): boolean {
  const missingAddress = !place.details.address?.trim();
  const missingPhoto = !place.facadePhotoUrl;
  const missingAudit =
    place.status !== 'gray' &&
    !place.details.verification?.verified_at &&
    !place.entranceNotes &&
    place.stepsCount == null;
  return missingAddress || missingPhoto || missingAudit;
}

export function applyPlaceFilters(places: PublicPlace[], filters: PlaceFilters): PublicPlace[] {
  const query = filters.query.trim().toLowerCase();
  return places.filter((place) => {
    if (filters.status !== 'all' && place.status !== filters.status) return false;
    if (filters.categories.length > 0 && !filters.categories.includes(place.category)) return false;
    if (!query) return true;
    const haystack = [
      place.name,
      place.details.address ?? '',
      place.comment ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

async function signFacadePhoto(storagePath: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from('place-photos')
    .createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function fetchPublishedPlaces(): Promise<PublicPlace[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Live Supabase configuration is required for public map data');
  }

  const supabase = getSupabaseClient();
  const { data: rows, error } = await supabase
    .from('places')
    .select(PLACE_COLUMNS)
    .eq('moderation_status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load published places: ${error.message}`);
  }

  const placeRows = (rows ?? []) as PlaceRow[];
  if (placeRows.length === 0) return [];

  const ids = placeRows.map((row) => row.id);
  const { data: photos, error: photosError } = await supabase
    .from('photos')
    .select(PHOTO_COLUMNS)
    .in('place_id', ids)
    .eq('kind', 'facade');

  if (photosError) {
    throw new Error(`Failed to load facade photos: ${photosError.message}`);
  }

  const facadeByPlace = new Map<string, string>();
  for (const photo of photos ?? []) {
    if (!facadeByPlace.has(photo.place_id)) {
      facadeByPlace.set(photo.place_id, photo.storage_path);
    }
  }

  return Promise.all(
    placeRows.map(async (row) => {
      const storagePath = facadeByPlace.get(row.id);
      let facadePhotoUrl: string | null = null;
      if (storagePath) {
        try {
          facadePhotoUrl = await signFacadePhoto(storagePath);
        } catch {
          facadePhotoUrl = null;
        }
      }
      const mapped = mapPlaceRow(row, facadePhotoUrl ?? undefined);
      return {
        ...mapped,
        facadePhotoError: Boolean(storagePath && !facadePhotoUrl),
      };
    }),
  );
}

export async function fetchPlaceById(placeId: string): Promise<PublicPlace | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Live Supabase configuration is required for public map data');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('places')
    .select(PLACE_COLUMNS)
    .eq('id', placeId)
    .eq('moderation_status', 'published')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load place: ${error.message}`);
  }
  if (!data) return null;

  const row = data as PlaceRow;
  const { data: photo } = await supabase
    .from('photos')
    .select(PHOTO_COLUMNS)
    .eq('place_id', placeId)
    .eq('kind', 'facade')
    .maybeSingle();

  let facadePhotoUrl: string | null = null;
  if (photo?.storage_path) {
    facadePhotoUrl = await signFacadePhoto(photo.storage_path);
  }

  return mapPlaceRow(row, facadePhotoUrl ?? undefined);
}

export function rampLabel(rampType: RampType): string {
  switch (rampType) {
    case 'permanent':
      return 'Стационарный пандус';
    case 'portable_available':
      return 'Приставной пандус';
    case 'portable_on_request':
      return 'Пандус по запросу';
    default:
      return 'Без пандуса';
  }
}

export function hasPortableRamp(rampType: RampType): boolean {
  return rampType === 'portable_available' || rampType === 'portable_on_request';
}
