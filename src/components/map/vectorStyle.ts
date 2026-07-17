/**
 * Vector tile style + default Abkhazia framing for the MapLibre adapter.
 *
 * On initial public load the map fits the Abkhazia bounding box. Precise live
 * geolocation is NEVER requested automatically — the user must explicitly
 * toggle the location control, and when a precise fix arrives it overrides
 * these default bounds via `flyTo` (see MapLibreMap.tsx).
 */

export const SUKHUM_CENTER = { lat: 43.0033, lng: 41.0237 } as const;

/**
 * Default zoom used for the initial center before `fitBounds` runs.
 * Kept in sync with the Leaflet default.
 */
export const DEFAULT_MAP_ZOOM = 15;

/** Default zoom target after the user explicitly selects a place. */
export const SELECTED_ZOOM = 16;

/** Default zoom target in draft-pin (add-place) mode. */
export const DRAFT_ZOOM = 17;

export const MAP_ATTRIBUTION = '© OpenStreetMap © CARTO';

/**
 * Abkhazia bounding box (WGS84). Order: [[west, south], [east, north]]
 * (MapLibre LngLatBounds-like array form).
 */
export const ABKHAZIA_BOUNDS: readonly [readonly [number, number], readonly [number, number]] = [
  [39.83, 42.55],
  [41.2, 43.62],
];

const VECTOR_STYLE_URLS = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
} as const;

export function getVectorStyleUrl(theme: 'light' | 'dark'): string {
  return VECTOR_STYLE_URLS[theme];
}
