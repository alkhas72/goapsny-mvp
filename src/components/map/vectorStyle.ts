export const SUKHUM_CENTER = { lat: 43.0033, lng: 41.0237 } as const;
export const DEFAULT_MAP_ZOOM = 15;

export const MAP_ATTRIBUTION =
  '© OpenStreetMap © CARTO';

const VECTOR_STYLE_URLS = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
} as const;

export function getVectorStyleUrl(theme: 'light' | 'dark'): string {
  return VECTOR_STYLE_URLS[theme];
}
