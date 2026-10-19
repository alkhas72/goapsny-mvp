/**
 * Initial camera for the public map: open on the places, not on the country.
 *
 * Places may be spread over several towns. Fitting all of them would bring
 * back the whole-country view, so the frame is taken around the densest
 * group: the place with the most neighbours within `CLUSTER_RADIUS_KM`
 * seeds it, and every place within that radius of the seed is included.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** [[west, south], [east, north]] — MapLibre LngLatBoundsLike array form. */
export type FrameBounds = [[number, number], [number, number]];

/** About the size of a town: Sukhum fits, Gagra and Gudauta stay apart. */
export const CLUSTER_RADIUS_KM = 12;

/** Above this many places the density search samples, to stay cheap. */
const MAX_SEEDS = 400;

const KM_PER_DEG_LAT = 111.32;

function distanceKm(a: LatLng, b: LatLng): number {
  // Equirectangular approximation: exact enough within a region this size.
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dx = (b.lng - a.lng) * KM_PER_DEG_LAT * Math.cos(meanLat);
  const dy = (b.lat - a.lat) * KM_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

function isUsable(p: LatLng): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

export function initialPlacesBounds(
  places: readonly LatLng[],
  radiusKm: number = CLUSTER_RADIUS_KM,
): FrameBounds | null {
  const points = places.filter(isUsable);
  if (points.length === 0) return null;

  const step = Math.max(1, Math.ceil(points.length / MAX_SEEDS));
  let seed = points[0];
  let best = -1;
  for (let i = 0; i < points.length; i += step) {
    let count = 0;
    for (const other of points) {
      if (distanceKm(points[i], other) <= radiusKm) count += 1;
    }
    if (count > best) {
      best = count;
      seed = points[i];
    }
  }

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const p of points) {
    if (distanceKm(seed, p) > radiusKm) continue;
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

export interface FramePadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Room around the places: the map-look button sits top right, the locate
 * button and attribution along the bottom. Never more than a quarter of the
 * side, or MapLibre refuses to fit on a short screen.
 */
export function framePadding(width: number, height: number): FramePadding {
  const clamp = (value: number, side: number) => Math.max(0, Math.min(value, Math.floor(side / 4)));
  return {
    top: clamp(72, height),
    right: clamp(72, width),
    bottom: clamp(88, height),
    left: clamp(48, width),
  };
}
