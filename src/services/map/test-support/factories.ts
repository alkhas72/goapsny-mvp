import type { Place } from '../../../types';

export function makePlace(overrides: Partial<Place> & { id: string }): Place {
  return {
    id: overrides.id,
    name: overrides.name ?? `Place ${overrides.id}`,
    category: overrides.category ?? 'food',
    lat: overrides.lat ?? 43.0,
    lng: overrides.lng ?? 41.0,
    status: overrides.status ?? 'gray',
    stepsCount: overrides.stepsCount ?? null,
    stepHeightCm: overrides.stepHeightCm ?? null,
    rampType: overrides.rampType ?? 'none',
    doorWidthCm: overrides.doorWidthCm ?? null,
    entranceNotes: overrides.entranceNotes ?? null,
    toiletExists: overrides.toiletExists ?? 'unknown',
    toiletAccessible: overrides.toiletAccessible ?? 'unknown',
    parking: overrides.parking ?? 'unknown',
    comment: overrides.comment ?? null,
    osmTags: overrides.osmTags ?? {},
    moderationStatus: overrides.moderationStatus ?? 'published',
    source: overrides.source ?? 'public',
    createdBy: overrides.createdBy ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00Z',
    mainPhoto: overrides.mainPhoto,
  };
}
