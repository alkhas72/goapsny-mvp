import { describe, expect, it } from 'vitest';
import {
  applyPlaceFilters,
  hasSeenWelcome,
  mapPlaceRow,
  markWelcomeSeen,
  publicPlaceFromSubmission,
  upsertPublicPlace,
  WELCOME_STORAGE_KEY,
  type PlaceRow,
  type PublicPlace,
} from './places';

const baseRow: PlaceRow = {
  id: '11111111-1111-1111-1111-111111111111',
  name: '  Тестовое место ',
  category: 'food',
  lat: 43,
  lng: 41,
  status: 'gray',
  steps_count: null,
  step_height_cm: null,
  ramp_type: 'none',
  door_width_cm: null,
  entrance_notes: null,
  toilet_exists: 'unknown',
  toilet_accessible: 'unknown',
  parking: 'unknown',
  comment: null,
  osm_tags: {},
  details: { schema_version: 1 },
  moderation_status: 'published',
  source: 'public',
  created_by: null,
  created_at: '2026-07-14T10:00:00.000Z',
  updated_at: '2026-07-14T10:00:00.000Z',
};

function makePlace(overrides: Partial<PublicPlace> = {}): PublicPlace {
  return {
    ...mapPlaceRow(baseRow),
    ...overrides,
  };
}

describe('mapPlaceRow', () => {
  it('maps gray status and trims name', () => {
    const mapped = mapPlaceRow(baseRow);
    expect(mapped.status).toBe('gray');
    expect(mapped.name).toBe('Тестовое место');
  });

  it('handles missing photo/details as partial without throwing', () => {
    const mapped = mapPlaceRow({
      ...baseRow,
      details: {},
      entrance_notes: null,
    });
    expect(mapped.details.schema_version).toBe(1);
    expect(mapped.facadePhotoUrl).toBeNull();
  });
});

describe('publicPlaceFromSubmission', () => {
  it('builds a gray published pin from the confirmed form snapshot', () => {
    const place = publicPlaceFromSubmission({
      placeId: '11111111-1111-4111-8111-111111111111',
      name: '  Кафе  ',
      category: 'food',
      lat: 43.01,
      lng: 41.02,
    });

    expect(place).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Кафе',
      category: 'food',
      lat: 43.01,
      lng: 41.02,
      status: 'gray',
      moderationStatus: 'published',
    });
  });
});

describe('upsertPublicPlace', () => {
  it('replaces an existing id and prepends the fresh row', () => {
    const existing = publicPlaceFromSubmission({
      placeId: 'a',
      name: 'Old',
      category: 'food',
      lat: 1,
      lng: 2,
    });
    const updated = publicPlaceFromSubmission({
      placeId: 'a',
      name: 'New',
      category: 'food',
      lat: 3,
      lng: 4,
    });
    const other = publicPlaceFromSubmission({
      placeId: 'b',
      name: 'Other',
      category: 'food',
      lat: 5,
      lng: 6,
    });

    expect(upsertPublicPlace([existing, other], updated)).toEqual([updated, other]);
  });
});

describe('applyPlaceFilters', () => {
  const places = [
    makePlace({ id: 'a', category: 'food', status: 'green', name: 'Кафе' }),
    makePlace({ id: 'b', category: 'health', status: 'gray', name: 'Аптека' }),
    makePlace({ id: 'c', category: 'food', status: 'red', name: 'Музей' }),
  ];

  it('filters by multiselect categories', () => {
    const result = applyPlaceFilters(places, {
      categories: ['food'],
      status: 'all',
      query: '',
    });
    expect(result.map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('filters by status and text query', () => {
    const result = applyPlaceFilters(places, {
      categories: [],
      status: 'gray',
      query: 'апт',
    });
    expect(result.map((p) => p.id)).toEqual(['b']);
  });

  it('тип внутри группы: «Здоровье» → только аптеки', () => {
    const typed = [
      makePlace({ id: 'p', category: 'health', placeType: 'pharmacy' }),
      makePlace({ id: 'h', category: 'health', placeType: 'hospital' }),
      makePlace({ id: 'u', category: 'health', placeType: null }),
    ];
    const result = applyPlaceFilters(typed, { categories: ['health'], types: ['pharmacy'], status: 'all', query: '' });
    expect(result.map((p) => p.id)).toEqual(['p']);
    // Без выбранного типа группа показывается целиком, вместе с местами без типа.
    expect(applyPlaceFilters(typed, { categories: ['health'], types: [], status: 'all', query: '' })).toHaveLength(3);
  });

  it('переключатель «есть доступный туалет»', () => {
    const withToilets = [
      makePlace({ id: 'y', toiletAccessible: 'yes' }),
      makePlace({ id: 'n', toiletAccessible: 'no' }),
      makePlace({ id: 'q', toiletAccessible: 'unknown' }),
    ];
    const result = applyPlaceFilters(withToilets, { categories: [], accessibleToilet: true, status: 'all', query: '' });
    expect(result.map((p) => p.id)).toEqual(['y']);
  });
});

describe('тип места из карточки', () => {
  it('название, записанное картографом, становится типом OSM', () => {
    const row = { ...baseRow, category: 'health', details: { schema_version: 1, mapper: { subtype: 'Аптека' } } };
    expect(mapPlaceRow(row as PlaceRow).placeType).toBe('pharmacy');
  });

  it('незнакомое название и пустая карточка типа не дают', () => {
    const odd = { ...baseRow, details: { schema_version: 1, mapper: { subtype: 'Что-то своё' } } };
    expect(mapPlaceRow(odd as PlaceRow).placeType).toBeNull();
    expect(mapPlaceRow(baseRow).placeType).toBeNull();
  });
});

describe('welcome persistence', () => {
  it('shows legend once and never persists on map state key', () => {
    localStorage.clear();
    expect(hasSeenWelcome()).toBe(false);
    markWelcomeSeen();
    expect(hasSeenWelcome()).toBe(true);
    expect(localStorage.getItem(WELCOME_STORAGE_KEY)).toBe('true');
    expect(localStorage.getItem('goapsny_map_legend_seen')).toBeNull();
  });
});
