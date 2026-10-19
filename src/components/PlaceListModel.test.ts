import { describe, expect, it } from 'vitest';
import type { PlaceFilters } from '../services/places';
import {
  boundsCenter,
  cameraNeedsPlace,
  countByStatus,
  emptyStateKind,
  entranceDetail,
  hasActiveFilter,
  isInBounds,
  placesInView,
  placesWord,
  readPlaceParam,
  sortByDistance,
  withPlaceParam,
} from './PlaceListModel';

const NO_FILTER: PlaceFilters = { categories: [], status: 'all', query: '' };
const AREA = { west: 41.0, south: 43.0, east: 41.1, north: 43.1 };

describe('visible area', () => {
  it('keeps only places inside the bounds, edges included', () => {
    const places = [
      { id: 'in', lat: 43.05, lng: 41.05 },
      { id: 'edge', lat: 43.0, lng: 41.1 },
      { id: 'north', lat: 43.2, lng: 41.05 },
      { id: 'west', lat: 43.05, lng: 40.9 },
    ];
    expect(placesInView(places, AREA).map((p) => p.id)).toEqual(['in', 'edge']);
    expect(isInBounds({ lat: 43.2, lng: 41.05 }, AREA)).toBe(false);
  });

  it('counts every place before the map reports its area', () => {
    const places = [{ lat: 0, lng: 0 }, { lat: 50, lng: 50 }];
    expect(placesInView(places, null)).toHaveLength(2);
  });

  it('finds the centre of the area', () => {
    expect(boundsCenter(AREA)).toEqual({ lat: 43.05, lng: 41.05 });
  });
});

describe('sortByDistance', () => {
  const places = [
    { name: 'Далеко', lat: 43.09, lng: 41.09 },
    { name: 'Близко', lat: 43.051, lng: 41.051 },
    { name: 'Средне', lat: 43.07, lng: 41.03 },
  ];

  it('puts the nearest to the centre first', () => {
    expect(sortByDistance(places, { lat: 43.05, lng: 41.05 }).map((p) => p.name)).toEqual([
      'Близко',
      'Средне',
      'Далеко',
    ]);
  });

  it('falls back to name order without a centre and does not mutate the input', () => {
    const copy = [...places];
    expect(sortByDistance(places, null).map((p) => p.name)).toEqual(['Близко', 'Далеко', 'Средне']);
    expect(places).toEqual(copy);
  });

  it('breaks distance ties by name', () => {
    const twins = [
      { name: 'Б', lat: 43.05, lng: 41.05 },
      { name: 'А', lat: 43.05, lng: 41.05 },
    ];
    expect(sortByDistance(twins, { lat: 43.05, lng: 41.05 }).map((p) => p.name)).toEqual(['А', 'Б']);
  });
});

describe('countByStatus', () => {
  it('counts each status and the total', () => {
    expect(
      countByStatus([{ status: 'green' }, { status: 'green' }, { status: 'gray' }, { status: 'red' }]),
    ).toEqual({ all: 4, green: 2, yellow: 0, red: 1, gray: 1 });
  });
});

describe('empty states', () => {
  const base = { loadState: 'ready' as const, boundsKnown: true, inViewCount: 0, filters: NO_FILTER };

  it('invites to add a place when an unfiltered area is empty', () => {
    expect(emptyStateKind(base)).toBe('blank');
  });

  it('offers a reset when a filter empties the area', () => {
    expect(emptyStateKind({ ...base, filters: { ...NO_FILTER, status: 'red' } })).toBe('filtered');
    expect(emptyStateKind({ ...base, filters: { ...NO_FILTER, categories: ['food'] } })).toBe('filtered');
    expect(emptyStateKind({ ...base, filters: { ...NO_FILTER, query: 'кафе' } })).toBe('filtered');
  });

  it('stays silent while loading, on error, before the map reports, or when places are visible', () => {
    expect(emptyStateKind({ ...base, loadState: 'loading' })).toBe('none');
    expect(emptyStateKind({ ...base, loadState: 'error' })).toBe('none');
    expect(emptyStateKind({ ...base, boundsKnown: false })).toBe('none');
    expect(emptyStateKind({ ...base, inViewCount: 3 })).toBe('none');
  });

  it('treats a blank query as no filter', () => {
    expect(hasActiveFilter({ ...NO_FILTER, query: '   ' })).toBe(false);
  });
});

describe('entranceDetail', () => {
  it('prefers the step count', () => {
    expect(entranceDetail({ stepsCount: 0, doorWidthCm: 90, rampType: 'none' })).toBe('Нет ступеней');
    expect(entranceDetail({ stepsCount: 3, doorWidthCm: null, rampType: 'none' })).toBe('3 ступени');
  });

  it('adds the ramp when there are steps', () => {
    expect(entranceDetail({ stepsCount: 3, doorWidthCm: null, rampType: 'portable_on_request' })).toBe(
      '3 ступени · пандус по запросу',
    );
  });

  it('falls back to the door width, then the ramp, then nothing', () => {
    expect(entranceDetail({ stepsCount: null, doorWidthCm: 90, rampType: 'permanent' })).toBe('Дверь 90 см');
    expect(entranceDetail({ stepsCount: null, doorWidthCm: null, rampType: 'permanent' })).toBe(
      'Стационарный пандус',
    );
    expect(entranceDetail({ stepsCount: null, doorWidthCm: null, rampType: 'none' })).toBeNull();
  });
});

describe('?place= link', () => {
  it('reads the place id', () => {
    expect(readPlaceParam('?mapper=1&place=abc')).toBe('abc');
    expect(readPlaceParam('?place=')).toBeNull();
    expect(readPlaceParam('')).toBeNull();
  });

  it('sets and removes the id, keeping other parameters and the hash', () => {
    expect(withPlaceParam('https://x.app/?mapper=1#map', 'abc')).toBe('/?mapper=1&place=abc#map');
    expect(withPlaceParam('https://x.app/?mapper=1&place=abc', 'def')).toBe('/?mapper=1&place=def');
    expect(withPlaceParam('https://x.app/?mapper=1&place=abc', null)).toBe('/?mapper=1');
    expect(withPlaceParam('https://x.app/?place=abc', null)).toBe('/');
  });
});

describe('cameraNeedsPlace', () => {
  const place = { lat: 43.0021, lng: 41.0189 };
  it('is false for a close-up around the place', () => {
    expect(cameraNeedsPlace(place, { west: 41.016, south: 42.999, east: 41.021, north: 43.004 })).toBe(false);
  });
  it('is true for the whole-country frame or an area without the place', () => {
    expect(cameraNeedsPlace(place, { west: 39.83, south: 42.27, east: 41.2, north: 43.89 })).toBe(true);
    expect(cameraNeedsPlace(place, { west: 41.03, south: 43.0, east: 41.04, north: 43.01 })).toBe(true);
  });
});

describe('placesWord', () => {
  it('declines «место»', () => {
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => `${n} ${placesWord(n)}`)).toEqual([
      '1 место',
      '2 места',
      '5 мест',
      '11 мест',
      '21 место',
      '22 места',
      '25 мест',
    ]);
  });
});
