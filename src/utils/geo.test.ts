import { describe, expect, it } from 'vitest';

import { distanceMeters, findNearbyPlaces, type PlacePoint } from './geo';

/** Сухум, центр — базовая точка-кандидат для всех кейсов. */
const candidate = { lat: 43.0, lng: 41.02 };

describe('findNearbyPlaces', () => {
  it('возвращает [] при пустом списке мест', () => {
    expect(findNearbyPlaces(candidate, [])).toEqual([]);
  });

  it('возвращает [] когда никто не попадает в радиус', () => {
    // +0.01° широты ≈ 1112 м — далеко за пределами 150 м
    const far: PlacePoint = { id: 'far', lat: 43.01, lng: 41.02 };
    expect(findNearbyPlaces(candidate, [far], { radiusMeters: 150 })).toEqual([]);
  });

  it('включает место внутри радиуса с расстоянием в метрах', () => {
    // +0.001° широты ≈ 111 м — внутри 150 м
    const near: PlacePoint = { id: 'near', lat: 43.001, lng: 41.02 };
    const result = findNearbyPlaces(candidate, [near], { radiusMeters: 150 });
    expect(result).toHaveLength(1);
    expect(result[0].place.id).toBe('near');
    expect(result[0].distanceMeters).toBeGreaterThan(110);
    expect(result[0].distanceMeters).toBeLessThan(112);
  });

  it('включает место ровно на границе радиуса', () => {
    const edge: PlacePoint = { id: 'edge', lat: 43.001, lng: 41.02 };
    const exactRadius = distanceMeters(candidate, edge);
    const result = findNearbyPlaces(candidate, [edge], { radiusMeters: exactRadius });
    expect(result.map((m) => m.place.id)).toEqual(['edge']);
  });

  it('сортирует несколько мест по возрастанию расстояния', () => {
    const places: PlacePoint[] = [
      { id: 'third', lat: 43.003, lng: 41.02 },
      { id: 'first', lat: 43.001, lng: 41.02 },
      { id: 'second', lat: 43.002, lng: 41.02 },
    ];
    const result = findNearbyPlaces(candidate, places, { radiusMeters: 500 });
    expect(result.map((m) => m.place.id)).toEqual(['first', 'second', 'third']);
  });
});
