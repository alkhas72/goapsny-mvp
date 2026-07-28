import { describe, expect, it } from 'vitest';
import type { PublicPlace } from './places';
import type { Place } from '../types';
import { publicPlaceToPlace } from './api';

const basePublicPlace: PublicPlace = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Тестовая точка',
  category: 'food',
  lat: 43.001,
  lng: 41.023,
  status: 'green',
  stepsCount: 0,
  stepHeightCm: 0,
  rampType: 'permanent',
  doorWidthCm: 90,
  entranceNotes: 'Плоский вход',
  toiletExists: 'yes',
  toiletAccessible: 'yes',
  parking: 'no',
  comment: 'Комментарий оператора',
  osmTags: { wheelchair: 'yes' },
  details: { schema_version: 1 },
  moderationStatus: 'published',
  source: 'operator',
  createdBy: 'u-operator',
  createdAt: '2026-07-17T10:00:00Z',
  updatedAt: '2026-07-17T10:00:00Z',
  facadePhotoUrl: 'https://example.supabase.co/storage/v1/sign/place-photos/abc/facade.jpg?token=xyz',
};

describe('publicPlaceToPlace', () => {
  it('maps every shared scalar field 1:1 from the public shape to the legacy Place shape', () => {
    const place = publicPlaceToPlace(basePublicPlace);

    expect(place.id).toBe(basePublicPlace.id);
    expect(place.name).toBe(basePublicPlace.name);
    expect(place.category).toBe(basePublicPlace.category);
    expect(place.lat).toBe(basePublicPlace.lat);
    expect(place.lng).toBe(basePublicPlace.lng);
    expect(place.status).toBe(basePublicPlace.status);
    expect(place.stepsCount).toBe(basePublicPlace.stepsCount);
    expect(place.stepHeightCm).toBe(basePublicPlace.stepHeightCm);
    expect(place.rampType).toBe(basePublicPlace.rampType);
    expect(place.doorWidthCm).toBe(basePublicPlace.doorWidthCm);
    expect(place.entranceNotes).toBe(basePublicPlace.entranceNotes);
    expect(place.toiletExists).toBe(basePublicPlace.toiletExists);
    expect(place.toiletAccessible).toBe(basePublicPlace.toiletAccessible);
    expect(place.parking).toBe(basePublicPlace.parking);
    expect(place.comment).toBe(basePublicPlace.comment);
    expect(place.osmTags).toEqual(basePublicPlace.osmTags);
    expect(place.moderationStatus).toBe(basePublicPlace.moderationStatus);
    expect(place.createdBy).toBe(basePublicPlace.createdBy);
    expect(place.createdAt).toBe(basePublicPlace.createdAt);
    expect(place.updatedAt).toBe(basePublicPlace.updatedAt);
  });

  it('maps facadePhotoUrl to mainPhoto so the Telegram contour renders the same facade photo', () => {
    const place = publicPlaceToPlace(basePublicPlace);
    expect(place.mainPhoto).toBe(basePublicPlace.facadePhotoUrl);
  });

  it('omits mainPhoto (undefined) when the public place has no signed facade URL', () => {
    const place = publicPlaceToPlace({ ...basePublicPlace, facadePhotoUrl: null });
    expect(place.mainPhoto).toBeUndefined();
  });

  it.each(['operator', 'public', 'import', 'ai_seed'] as const)(
    'preserves a known Place source value: %s',
    (source) => {
      const place = publicPlaceToPlace({ ...basePublicPlace, source });
      expect(place.source).toBe(source);
    },
  );

  it('coerces an unknown source string to "public" so the result type stays a valid Place.source union', () => {
    // Live Supabase rows are untyped at the boundary; an unknown source must not
    // leak into the client type as an arbitrary string.
    const place = publicPlaceToPlace({ ...basePublicPlace, source: 'unknown_source' });
    expect(place.source).toBe('public');
  });

  it('drops PublicPlace-only fields (details, facadePhotoError) so the result conforms to Place', () => {
    const place: Place = publicPlaceToPlace({
      ...basePublicPlace,
      facadePhotoError: true,
    });
    expect((place as unknown as Record<string, unknown>).details).toBeUndefined();
    expect((place as unknown as Record<string, unknown>).facadePhotoError).toBeUndefined();
  });
});
