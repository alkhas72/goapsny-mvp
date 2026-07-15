export interface GeoPosition {
  lat: number;
  lng: number;
}

export function getBrowserLocation(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}
