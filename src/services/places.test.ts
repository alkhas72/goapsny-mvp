import { describe, expect, it } from 'vitest';
import {
  applyPlaceFilters,
  hasSeenWelcome,
  mapPlaceRow,
  markWelcomeSeen,
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
