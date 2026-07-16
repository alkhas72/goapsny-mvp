import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Place } from '../../types';

const mockMapInstance = {
  on: vi.fn(),
  off: vi.fn(),
  remove: vi.fn(),
  setStyle: vi.fn(),
  flyTo: vi.fn(),
  jumpTo: vi.fn(),
  addControl: vi.fn(),
  resize: vi.fn(),
};

const markerInstances: Array<{
  element: HTMLDivElement;
  setLngLat: ReturnType<typeof vi.fn>;
  addTo: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  setDraggable: ReturnType<typeof vi.fn>;
  getLngLat: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('maplibre-gl', () => {
  function MockMap(this: typeof mockMapInstance) {
    return mockMapInstance;
  }

  function MockMarker(this: (typeof markerInstances)[number], options?: { element?: HTMLElement }) {
    this.element = (options?.element as HTMLDivElement) ?? document.createElement('div');
    this.setLngLat = vi.fn().mockReturnThis();
    this.addTo = vi.fn(function addTo(this: (typeof markerInstances)[number]) {
      document.body.appendChild(this.element);
      return this;
    });
    this.remove = vi.fn(function remove(this: (typeof markerInstances)[number]) {
      this.element.remove();
    });
    this.on = vi.fn();
    this.setDraggable = vi.fn().mockReturnThis();
    this.getLngLat = vi.fn(() => ({ lat: 43, lng: 41 }));
    markerInstances.push(this);
  }

  MockMarker.prototype.getElement = function getElement(this: (typeof markerInstances)[number]) {
    return this.element;
  };

  function MockNavigationControl() {
    return {};
  }

  function MockAttributionControl() {
    return {};
  }

  return {
    default: {
      Map: MockMap,
      Marker: MockMarker,
      NavigationControl: MockNavigationControl,
      AttributionControl: MockAttributionControl,
    },
  };
});

import { MapLibreMap } from './MapLibreMap';

const samplePlaces: Place[] = [
  {
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
  },
];

describe('MapLibreMap', () => {
  beforeEach(() => {
    markerInstances.length = 0;
    vi.clearAllMocks();
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(function ResizeObserverStub(this: { observe: () => void; disconnect: () => void }) {
        this.observe = vi.fn();
        this.disconnect = vi.fn();
      }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('mounts a vector map and renders accessible marker buttons', () => {
    render(
      <MapLibreMap
        places={samplePlaces}
        selectedPlaceId={null}
        theme="light"
        onSelectPlace={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Кафе Серый/i })).toBeTruthy();
    expect(markerInstances).toHaveLength(1);
  });

  it('exposes marker buttons through onMarkerButton callback', () => {
    const onMarkerButton = vi.fn();
    render(
      <MapLibreMap
        places={samplePlaces}
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

  it('calls onSelectPlace when marker button is activated', async () => {
    const onSelectPlace = vi.fn();
    const user = userEvent.setup();

    render(
      <MapLibreMap
        places={samplePlaces}
        selectedPlaceId={null}
        theme="light"
        onSelectPlace={onSelectPlace}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Кафе Серый/i }));
    expect(onSelectPlace).toHaveBeenCalledWith('place-1');
  });
});
