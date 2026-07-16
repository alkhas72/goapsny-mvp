import type {
  MapAdapter,
  MapAdapterOptions,
  NetworkStatus,
  ResizeObserverFactory,
  ResizeObserverLike,
} from '../types';
import type { Place } from '../../../types';
import { renderMarkerPin, wireMarkerButton } from '../markers';

export interface MemoryMapAdapterExtras {
  readonly isMounted: boolean;
  readonly networkStatus: NetworkStatus;
  simulateTileError(sourceId?: string): void;
}

export interface ResizeObserverStub {
  factory: ResizeObserverFactory;
  readonly observed: ReadonlyArray<Element>;
  fire(): void;
}

export function createResizeObserverStub(): ResizeObserverStub {
  let callback: ResizeObserverCallback | null = null;
  const observed: Element[] = [];

  const factory: ResizeObserverFactory = (cb) => {
    callback = cb;
    return {
      observe: (target) => {
        observed.push(target);
      },
      disconnect: () => {
        observed.length = 0;
        callback = null;
      },
    };
  };

  return {
    factory,
    get observed() {
      return observed;
    },
    fire: () => {
      if (callback) {
        callback(
          [],
          { observe: () => undefined, disconnect: () => undefined, unobserve: () => undefined } as ResizeObserver,
        );
      }
    },
  };
}

export function createMemoryMapAdapter(options: MapAdapterOptions = {}): MapAdapter & MemoryMapAdapterExtras {
  let container: HTMLElement | null = null;
  let markerLayer: HTMLElement | null = null;
  let tileLayer: HTMLElement | null = null;
  let resizeObserver: ResizeObserverLike | null = null;
  let mounted = false;
  let theme: 'light' | 'dark' = options.theme ?? 'dark';
  let selectedPlaceId: string | null = null;
  let places: Place[] = [];
  let networkStatus: NetworkStatus = 'online';
  const cleanupByPlace = new Map<string, () => void>();

  const createResizeObserver: ResizeObserverFactory =
    options.createResizeObserver ??
    ((callback) => {
      const RO = window.ResizeObserver;
      if (!RO) {
        throw new Error('ResizeObserver is not available');
      }
      return new RO(callback);
    });

  const clearMarkers = () => {
    for (const cleanup of cleanupByPlace.values()) {
      cleanup();
    }
    cleanupByPlace.clear();
    markerLayer?.replaceChildren();
  };

  const renderMarkers = () => {
    if (!markerLayer) return;
    clearMarkers();
    for (const place of places) {
      const isSelected = place.id === selectedPlaceId;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderMarkerPin(place, isSelected);
      const button = wrapper.querySelector('button');
      if (!button) continue;
      markerLayer.appendChild(button);
      const release = wireMarkerButton(button, place.id, {
        onSelectPlace: options.onSelectPlace,
        onMarkerButton: options.onMarkerButton,
      });
      cleanupByPlace.set(place.id, () => {
        release();
        button.remove();
      });
    }
  };

  const handleContainerClick = (event: MouseEvent) => {
    if (event.target === container || event.target === markerLayer) {
      options.onClearSelection?.();
    }
  };

  const handleError = (event: ErrorEvent) => {
    const target = event.target as HTMLElement | null;
    const sourceId = target?.getAttribute('data-map-source-id') ?? undefined;
    options.onError?.({ kind: 'tile', sourceId, message: 'Tile source failed to load' });
  };

  return {
    get isMounted() {
      return mounted;
    },
    get networkStatus() {
      return networkStatus;
    },

    mount(target) {
      if (mounted) return;
      container = target;
      container.classList.add('map-adapter-container');
      container.setAttribute('data-theme', theme);

      tileLayer = document.createElement('div');
      tileLayer.className = 'map-tile-layer';
      tileLayer.setAttribute('data-map-source-id', 'tiles');
      tileLayer.setAttribute('aria-hidden', 'true');
      container.appendChild(tileLayer);

      markerLayer = document.createElement('div');
      markerLayer.className = 'map-marker-layer';
      container.appendChild(markerLayer);

      container.addEventListener('click', handleContainerClick);
      container.addEventListener('error', handleError, true);

      resizeObserver = createResizeObserver(() => {
        // Parity: a real adapter would call map.resize() / invalidateSize() here.
      });
      resizeObserver.observe(container);

      mounted = true;
      renderMarkers();
    },

    destroy() {
      if (!mounted) return;
      clearMarkers();
      resizeObserver?.disconnect();
      resizeObserver = null;
      container?.removeEventListener('click', handleContainerClick);
      container?.removeEventListener('error', handleError, true);
      tileLayer?.remove();
      tileLayer = null;
      markerLayer?.remove();
      markerLayer = null;
      container = null;
      mounted = false;
    },

    setPlaces(next, nextSelected = null) {
      places = next;
      selectedPlaceId = nextSelected ?? selectedPlaceId;
      renderMarkers();
    },

    setSelectedPlaceId(id) {
      selectedPlaceId = id;
      renderMarkers();
    },

    setTheme(next) {
      theme = next;
      container?.setAttribute('data-theme', theme);
    },

    setDragMode(next) {
      if (next) {
        clearMarkers();
      } else {
        renderMarkers();
      }
    },

    setNetworkStatus(status) {
      networkStatus = status;
      container?.setAttribute('data-network', status);
      options.onNetworkChange?.(status === 'online');
    },

    simulateTileError(sourceId = 'tiles') {
      if (!tileLayer) return;
      tileLayer.setAttribute('data-map-source-id', sourceId);
      tileLayer.dispatchEvent(new Event('error', { bubbles: true }));
    },
  };
}
