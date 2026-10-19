/**
 * Vector tile style + default Abkhazia framing for the MapLibre adapter.
 *
 * On initial public load the map frames the places (see initialView.ts), or
 * Sukhum at town scale when there are none. Precise live
 * geolocation is NEVER requested automatically — the user must explicitly
 * toggle the location control, and when a precise fix arrives it overrides
 * these default bounds via `flyTo` (see MapLibreMap.tsx).
 */

import type { StyleSpecification } from 'maplibre-gl';
import { buildGoApsnyStyle, type BasemapOptions, type BasemapTheme } from './goapsnyBasemap';

export const SUKHUM_CENTER = { lat: 43.0033, lng: 41.0237 } as const;

/**
 * Default zoom used for the initial center before `fitBounds` runs.
 * Kept in sync with the Leaflet default.
 */
export const DEFAULT_MAP_ZOOM = 15;

/** Town-wide view of Sukhum when there are no places to frame yet. */
export const CITY_ZOOM = 13.5;

/** Closest zoom when the initial view frames the places. */
export const PLACES_MAX_ZOOM = 16;

/** Default zoom target after the user explicitly selects a place. */
export const SELECTED_ZOOM = 16;

/** Default zoom target in draft-pin (add-place) mode. */
export const DRAFT_ZOOM = 17;

/** Map credits: OSM/MapLibre/AIS canon requires clickable links. */
export const MAP_ATTRIBUTION_ITEMS: readonly { label: string; href?: string }[] = [
  { label: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' },
  { label: 'MapLibre', href: 'https://maplibre.org' },
  { label: 'Protomaps', href: 'https://protomaps.com' },
  { label: 'АИС «Инва-Содействие»' },
];

/** The same credits as one HTML line. */
export const MAP_ATTRIBUTION = MAP_ATTRIBUTION_ITEMS.map((item) =>
  item.href ? `<a href="${item.href}" target="_blank" rel="noopener noreferrer">${item.label}</a>` : item.label,
).join(' · ');

/**
 * Abkhazia bounding box (WGS84). Order: [[west, south], [east, north]]
 * (MapLibre LngLatBounds-like array form).
 */
export const ABKHAZIA_BOUNDS: readonly [readonly [number, number], readonly [number, number]] = [
  [39.83, 42.55],
  [41.2, 43.62],
];

/**
 * Map style for a theme. Default is the own GoApsny basemap over the
 * Abkhazia PMTiles extract; an env style URL overrides it (e.g. to compare
 * with a hosted style).
 */
export function getVectorStyle(
  theme: BasemapTheme,
  options: BasemapOptions = {},
): string | StyleSpecification {
  const envOverride =
    theme === 'dark'
      ? (import.meta.env.VITE_MAP_STYLE_DARK as string | undefined)
      : (import.meta.env.VITE_MAP_STYLE_LIGHT as string | undefined);

  return envOverride || buildGoApsnyStyle(theme, options);
}
