import { describe, expect, it } from 'vitest';
import { framePadding, initialPlacesBounds } from './initialView';

const sukhum = [
  { lat: 42.9985, lng: 41.0125 },
  { lat: 43.0021, lng: 41.0189 },
  { lat: 43.0049, lng: 41.0172 },
  { lat: 42.9978, lng: 41.0201 },
];
const gagra = { lat: 43.3289, lng: 40.2155 };

describe('initialPlacesBounds', () => {
  it('returns null when there is nothing to show', () => {
    expect(initialPlacesBounds([])).toBeNull();
    expect(initialPlacesBounds([{ lat: Number.NaN, lng: 41 }])).toBeNull();
  });

  it('frames every place of a single town', () => {
    expect(initialPlacesBounds(sukhum)).toEqual([
      [41.0125, 42.9978],
      [41.0201, 43.0049],
    ]);
  });

  it('opens on the densest town, not on the whole country', () => {
    const bounds = initialPlacesBounds([gagra, ...sukhum]);
    expect(bounds).toEqual([
      [41.0125, 42.9978],
      [41.0201, 43.0049],
    ]);
  });

  it('frames a lone place as a point', () => {
    expect(initialPlacesBounds([gagra])).toEqual([
      [gagra.lng, gagra.lat],
      [gagra.lng, gagra.lat],
    ]);
  });
});

describe('framePadding', () => {
  it('leaves room for the map buttons on a phone', () => {
    expect(framePadding(390, 670)).toEqual({ top: 72, right: 72, bottom: 88, left: 48 });
  });

  it('never takes more than a quarter of a side', () => {
    expect(framePadding(120, 200)).toEqual({ top: 50, right: 30, bottom: 50, left: 30 });
    expect(framePadding(0, 0)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});
