import { describe, expect, it } from 'vitest';
import { isMapLibreEnabled, resolveMapEngine } from './mapEngine';

describe('resolveMapEngine', () => {
  it('defaults to leaflet when env flag is absent', () => {
    expect(resolveMapEngine({})).toBe('leaflet');
  });

  it('defaults to leaflet for unknown engine values', () => {
    expect(resolveMapEngine({ VITE_MAP_ENGINE: 'google' })).toBe('leaflet');
  });

  it('opts into maplibre when VITE_MAP_ENGINE=maplibre', () => {
    expect(resolveMapEngine({ VITE_MAP_ENGINE: 'maplibre' })).toBe('maplibre');
  });

  it('normalizes case and whitespace for maplibre flag', () => {
    expect(resolveMapEngine({ VITE_MAP_ENGINE: ' MapLibre ' })).toBe('maplibre');
  });
});

describe('isMapLibreEnabled', () => {
  it('returns false until parity flag is set', () => {
    expect(isMapLibreEnabled({})).toBe(false);
  });

  it('returns true when maplibre engine is selected', () => {
    expect(isMapLibreEnabled({ VITE_MAP_ENGINE: 'maplibre' })).toBe(true);
  });
});
