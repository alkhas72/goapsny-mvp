import { describe, expect, it } from 'vitest';

import { findNearbyPlaces } from './geo';

/** Сухум, центр — базовая точка-кандидат для всех кейсов. */
const candidate = { lat: 43.0, lng: 41.02 };

describe('findNearbyPlaces', () => {
  it('возвращает [] при пустом списке мест', () => {
    expect(findNearbyPlaces(candidate, [])).toEqual([]);
  });
});
