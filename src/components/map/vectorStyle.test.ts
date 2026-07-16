import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAP_ZOOM,
  MAP_ATTRIBUTION,
  SUKHUM_CENTER,
  getVectorStyleUrl,
} from './vectorStyle';

describe('vectorStyle', () => {
  it('targets Carto Voyager vector style for light theme', () => {
    expect(getVectorStyleUrl('light')).toBe(
      'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    );
  });

  it('targets Carto Dark Matter vector style for dark theme', () => {
    expect(getVectorStyleUrl('dark')).toBe(
      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    );
  });

  it('keeps Sukhum center and default zoom aligned with Leaflet map', () => {
    expect(SUKHUM_CENTER).toEqual({ lat: 43.0033, lng: 41.0237 });
    expect(DEFAULT_MAP_ZOOM).toBe(15);
  });

  it('includes OSM and CARTO attribution text', () => {
    expect(MAP_ATTRIBUTION).toContain('OpenStreetMap');
    expect(MAP_ATTRIBUTION).toContain('CARTO');
  });
});
