import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MapView } from './MapView';
import type { MapViewProps } from './types';

vi.mock('./LeafletMapAdapter', () => ({
  LeafletMapAdapter: () => <div data-testid="leaflet-map">leaflet</div>,
}));

vi.mock('./MapLibreMap', () => ({
  MapLibreMap: () => <div data-testid="maplibre-map">maplibre</div>,
}));

const baseProps: MapViewProps = {
  places: [],
  selectedPlaceId: null,
  theme: 'light',
};

describe('MapView adapter', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps Leaflet as the default public map engine', () => {
    render(<MapView {...baseProps} />);
    expect(screen.getByTestId('leaflet-map')).toBeTruthy();
    expect(screen.queryByTestId('maplibre-map')).toBeNull();
  });

  it('switches to MapLibre when parity flag is enabled', () => {
    render(<MapView {...baseProps} engine="maplibre" />);
    expect(screen.getByTestId('maplibre-map')).toBeTruthy();
    expect(screen.queryByTestId('leaflet-map')).toBeNull();
  });
});
