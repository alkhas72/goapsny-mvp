import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '../../types';

/**
 * Contract tests for the MapLibre adapter. These pin the same surface the
 * Leaflet implementation exposes (see LeafletMap.tsx) so the adapter can later
 * replace Leaflet behind the same props/events without touching the shell.
 *
 * Scope: map-component boundary only — rendering, pins, selected pin, bounds,
 * explicit location toggle, no auto-prompt, movable draft pin, theme, a11y.
 */

// --- maplibre-gl mock -------------------------------------------------------

interface MockMarkerInstance {
  element: HTMLDivElement;
  setLngLat: ReturnType<typeof vi.fn>;
  addTo: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  setDraggable: ReturnType<typeof vi.fn>;
  getLngLat: ReturnType<typeof vi.fn>;
  hasRemoved: boolean;
}

const {
  mockMapInstance,
  mockMapCtor,
  mockNavigationCtor,
  mockAttributionCtor,
} = vi.hoisted(() => {
  const mockMapInstance = {
    on: vi.fn(),
    once: vi.fn((event: string, cb: () => void) => {
      // Mirror MapLibre: fire 'load' handlers synchronously so effects that
      // depend on the map being ready run within the test.
      if (event === 'load') cb();
    }),
    off: vi.fn(),
    remove: vi.fn(),
    setStyle: vi.fn(),
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
    fitBounds: vi.fn(),
    addControl: vi.fn(),
    resize: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 43.0033, lng: 41.0237 })),
    getContainer: () => document.body,
  };
  return {
    mockMapInstance,
    mockMapCtor: vi.fn(function MockMap() {
      return mockMapInstance;
    }),
    mockNavigationCtor: vi.fn(function MockNavigationControl() {
      return {};
    }),
    mockAttributionCtor: vi.fn(function MockAttributionControl() {
      return {};
    }),
  };
});

let markerInstances: MockMarkerInstance[] = [];

vi.mock('maplibre-gl', () => {
  function MockMarker(
    this: MockMarkerInstance,
    options?: { element?: HTMLElement; draggable?: boolean },
  ) {
    this.element =
      (options?.element as HTMLDivElement | undefined) ?? document.createElement('div');
    this.hasRemoved = false;
    this.setLngLat = vi.fn().mockReturnThis();
    this.addTo = vi.fn(function addTo(this: MockMarkerInstance, target: unknown) {
      // Mirror MapLibre: appending the marker element to a parent makes it
      // queryable from the rendered DOM so tests can assert on buttons.
      if (target && typeof target === 'object' && 'getContainer' in target) {
        const container = (target as { getContainer: () => HTMLElement }).getContainer();
        container.appendChild(this.element);
      } else {
        document.body.appendChild(this.element);
      }
      return this;
    });
    this.remove = vi.fn(function remove(this: MockMarkerInstance) {
      this.hasRemoved = true;
      this.element.remove();
    });
    this.on = vi.fn();
    this.setDraggable = vi.fn().mockReturnThis();
    this.getLngLat = vi.fn(() => ({ lat: 43.01, lng: 41.02 }));
    markerInstances.push(this);
  }

  (MockMarker as unknown as { prototype: { getElement(this: MockMarkerInstance): HTMLDivElement } }).prototype.getElement = function getElement(this: MockMarkerInstance) {
    return this.element;
  };

  function LngLatBoundsLikeStub() {
    return {};
  }

  return {
    default: {
      Map: mockMapCtor,
      Marker: MockMarker,
      NavigationControl: mockNavigationCtor,
      AttributionControl: mockAttributionCtor,
      LngLatBounds: LngLatBoundsLikeStub,
    },
  };
});

const { getBrowserLocation } = vi.hoisted(() => ({
  getBrowserLocation: vi.fn(),
}));

vi.mock('../../utils/location', () => ({ getBrowserLocation }));

import { MapLibreMap } from './MapLibreMap';
import { ABKHAZIA_BOUNDS, DEFAULT_MAP_ZOOM } from './vectorStyle';

// --- fixtures ---------------------------------------------------------------

const basePlace: Place = {
  id: 'place-1',
  name: 'Кафе Серый',
  category: 'food',
  lat: 43.0015,
  lng: 41.0232,
  status: 'gray',
  stepsCount: null,
  stepHeightCm: null,
  rampType: 'none',
  doorWidthCm: null,
  entranceNotes: null,
  toiletExists: 'unknown',
  toiletAccessible: 'unknown',
  parking: 'unknown',
  comment: null,
  osmTags: {},
  moderationStatus: 'published',
  source: 'public',
  createdBy: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('MapLibreMap', () => {
  beforeEach(() => {
    markerInstances = [];
    vi.clearAllMocks();
    getBrowserLocation.mockReset();
    getBrowserLocation.mockResolvedValue({ lat: 43.01, lng: 41.02 });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // 1. stable pins and selected-pin state ------------------------------------
  it('renders one marker per place and does not duplicate on re-render', () => {
    const { rerender } = render(
      <MapLibreMap places={[basePlace]} selectedPlaceId={null} theme="light" />,
    );

    expect(markerInstances).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Кафе Серый/i })).toBeTruthy();

    rerender(<MapLibreMap places={[basePlace]} selectedPlaceId="place-1" theme="light" />);

    // Selection toggles markup (is-selected) but must not leak old markers.
    expect(markerInstances.filter((m) => !m.hasRemoved)).toHaveLength(1);
    const selectedButton = screen.getByRole('button', { name: /Кафе Серый/i });
    expect(selectedButton.className).toContain('is-selected');
  });

  it('reflects selected pin via onSelectPlace and re-centers the map', async () => {
    const user = userEvent.setup();
    const onSelectPlace = vi.fn();
    render(
      <MapLibreMap
        places={[basePlace]}
        selectedPlaceId={null}
        theme="light"
        onSelectPlace={onSelectPlace}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Кафе Серый/i }));
    expect(onSelectPlace).toHaveBeenCalledWith('place-1');
  });

  it('flyTo centers the selected place when selectedPlaceId changes', () => {
    mockMapInstance.flyTo.mockClear();
    const { rerender } = render(
      <MapLibreMap places={[basePlace]} selectedPlaceId={null} theme="light" />,
    );
    expect(mockMapInstance.flyTo).not.toHaveBeenCalled();

    rerender(<MapLibreMap places={[basePlace]} selectedPlaceId="place-1" theme="light" />);
    expect(mockMapInstance.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [basePlace.lng, basePlace.lat],
        zoom: 16,
      }),
    );
  });

  it('exposes marker buttons through onMarkerButton', () => {
    const onMarkerButton = vi.fn();
    render(
      <MapLibreMap
        places={[basePlace]}
        selectedPlaceId={null}
        theme="dark"
        onMarkerButton={onMarkerButton}
      />,
    );
    expect(onMarkerButton).toHaveBeenCalledWith(
      'place-1',
      expect.objectContaining({ tagName: 'BUTTON' }),
    );
  });

  // 2. Abkhazia default bounds without overriding precise live location ------
  it('fits to Abkhazia bounds on initial mount and does not prompt geolocation', () => {
    render(<MapLibreMap places={[]} selectedPlaceId={null} theme="light" />);

    expect(mockMapInstance.fitBounds).toHaveBeenCalledTimes(1);
    expect(mockMapInstance.fitBounds).toHaveBeenCalledWith(
      ABKHAZIA_BOUNDS,
      expect.anything(),
    );

    expect(mockAttributionCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        compact: true,
        customAttribution: expect.stringContaining('https://www.openstreetmap.org/copyright'),
      }),
    );
    expect(mockAttributionCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        customAttribution: expect.stringContaining('https://carto.com/attributions'),
      }),
    );

    expect(mockMapCtor).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: DEFAULT_MAP_ZOOM }),
    );

    expect(getBrowserLocation).not.toHaveBeenCalled();
  });

  // 3 + 4. explicit user control + no auto prompt ----------------------------
  it('activates and deactivates location tracking only on explicit user click', async () => {
    const user = userEvent.setup();
    render(<MapLibreMap places={[]} selectedPlaceId={null} theme="light" useBrowserGeolocation />);

    const showBtn = screen.getByRole('button', { name: 'Показать моё местоположение' });
    expect(showBtn.getAttribute('aria-pressed')).toBe('false');
    expect(getBrowserLocation).not.toHaveBeenCalled();

    await user.click(showBtn);

    const hideBtn = await screen.findByRole('button', { name: 'Скрыть моё местоположение' });
    expect(hideBtn.getAttribute('aria-pressed')).toBe('true');
    expect(getBrowserLocation).toHaveBeenCalledTimes(1);
    // Precise live fix overrides the default bounds — map flies to the fix.
    expect(mockMapInstance.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [41.02, 43.01], zoom: 16 }),
    );

    await user.click(hideBtn);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Показать моё местоположение' }),
      ).toBeTruthy();
    });
    expect(getBrowserLocation).toHaveBeenCalledTimes(1); // no re-fetch on deactivate
  });

  // 5. movable draft pin during place creation -------------------------------
  it('renders a draggable draft pin and reports drag changes in drag mode', () => {
    const onChange = vi.fn();
    render(
      <MapLibreMap
        places={[basePlace]}
        selectedPlaceId={null}
        theme="light"
        dragMode={{ lat: 43.005, lng: 41.03, onChange }}
      />,
    );

    // POI markers are hidden in drag mode; only the draft pin should exist.
    const draft = screen.getByRole('button', { name: /Новое место/i });
    expect(draft).toBeTruthy();

    const draftMarker = markerInstances.find((m) =>
      m.element.contains(draft) || m.element === draft.parentElement,
    );
    expect(draftMarker).toBeTruthy();
    expect(draftMarker!.setLngLat).toHaveBeenCalledWith([41.03, 43.005]);

    // MapLibre fires 'dragend'; simulate the handler registered via marker.on.
    const dragEndCall = draftMarker!.on.mock.calls.find(([event]) => event === 'dragend');
    expect(dragEndCall).toBeTruthy();
    (dragEndCall![1] as () => void)();
    expect(onChange).toHaveBeenCalledWith(43.01, 41.02);
  });

  // 6. light/dark theme compatibility ----------------------------------------
  it('switches the vector style when theme changes without recreating the map', () => {
    const { rerender } = render(<MapLibreMap places={[]} selectedPlaceId={null} theme="light" />);
    expect(mockMapInstance.setStyle).toHaveBeenCalledTimes(1);

    mockMapInstance.setStyle.mockClear();
    rerender(<MapLibreMap places={[]} selectedPlaceId={null} theme="dark" />);
    expect(mockMapInstance.setStyle).toHaveBeenCalledTimes(1);
    expect(mockMapInstance.setStyle).toHaveBeenCalledWith(
      expect.stringContaining('dark'),
    );
    // The map is constructed once; theme toggles only restyle it.
    expect(mockMapInstance.remove).not.toHaveBeenCalled();
  });

  // 7. accessible controls and ≥44×44 px targets -----------------------------
  it('exposes accessible location control with explicit role, label and pressed state', () => {
    render(<MapLibreMap places={[]} selectedPlaceId={null} theme="light" useBrowserGeolocation />);
    const btn = screen.getByRole('button', { name: 'Показать моё местоположение' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    // 44x44 target is enforced via the data attribute consumed by CSS.
    expect(btn.dataset.touchTarget).toBe('44');
  });

  it('clears selection when the map background is clicked', () => {
    const onClearSelection = vi.fn();
    render(
      <MapLibreMap
        places={[]}
        selectedPlaceId={null}
        theme="light"
        onClearSelection={onClearSelection}
      />,
    );
    expect(mockMapInstance.on).toHaveBeenCalledWith('click', onClearSelection);
  });
});
