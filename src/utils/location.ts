export interface GeoPosition {
  lat: number;
  lng: number;
}

const TARGET_ACCURACY_METERS = 50;
const LOCATION_TIMEOUT_MS = 12_000;

export function getBrowserLocation(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    const geolocation = navigator.geolocation;
    if (!geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    let bestPosition: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      if (watchId !== null) geolocation.clearWatch(watchId);
    };

    const finish = (position: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    };

    const fail = (error: GeolocationPositionError | Error) => {
      if (settled) return;
      if (bestPosition) {
        finish(bestPosition);
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const timeoutId = window.setTimeout(() => {
      if (bestPosition) {
        finish(bestPosition);
      } else {
        fail(new Error('Geolocation timed out'));
      }
    }, LOCATION_TIMEOUT_MS);

    watchId = geolocation.watchPosition(
      (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }
        if (position.coords.accuracy <= TARGET_ACCURACY_METERS) {
          finish(position);
        }
      },
      fail,
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 0 },
    );
  });
}
