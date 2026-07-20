import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBrowserLocation } from './location';

function position(lat: number, lng: number, accuracy: number): GeolocationPosition {
  return {
    coords: {
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude: lat,
      longitude: lng,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  };
}

describe('getBrowserLocation', () => {
  let onPosition: PositionCallback;
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((success: PositionCallback) => {
    onPosition = success;
    return 17;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    clearWatch.mockClear();
    watchPosition.mockClear();
    vi.stubGlobal('navigator', {
      geolocation: { watchPosition, clearWatch },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('waits for a precise GPS update instead of accepting the first coarse reading', async () => {
    const resultPromise = getBrowserLocation();

    onPosition(position(42.9, 41.1, 900));
    onPosition(position(43.0033, 41.0237, 24));

    await expect(resultPromise).resolves.toEqual({ lat: 43.0033, lng: 41.0237 });
    expect(clearWatch).toHaveBeenCalledWith(17);
    expect(watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true, maximumAge: 0 }),
    );
  });

  it('uses the best available reading when the precision target is not reached in time', async () => {
    const resultPromise = getBrowserLocation();

    onPosition(position(42.9, 41.1, 900));
    onPosition(position(43.01, 41.02, 120));
    await vi.advanceTimersByTimeAsync(12_000);

    await expect(resultPromise).resolves.toEqual({ lat: 43.01, lng: 41.02 });
    expect(clearWatch).toHaveBeenCalledWith(17);
  });
});
