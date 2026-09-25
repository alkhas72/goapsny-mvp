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

/** HTML attribution; OSM/MapLibre/AIS canon requires clickable links. */
export const MAP_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> · ' +
  '<a href="https://maplibre.org" target="_blank" rel="noopener noreferrer">MapLibre</a> · ' +
  'АИС «Инва-Содействие»';

/**
 * Abkhazia bounding box (WGS84). Order: [[west, south], [east, north]]
 * (MapLibre LngLatBounds-like array form).
 */
export const ABKHAZIA_BOUNDS: readonly [readonly [number, number], readonly [number, number]] = [
  [39.83, 42.55],
  [41.2, 43.62],
];

const DEFAULT_VECTOR_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

export function getVectorStyleUrl(theme: 'light' | 'dark'): string {
  const envOverride =
    theme === 'dark'
      ? (import.meta.env.VITE_MAP_STYLE_DARK as string | undefined)
      : (import.meta.env.VITE_MAP_STYLE_LIGHT as string | undefined);

  return envOverride || DEFAULT_VECTOR_STYLES[theme];
}
