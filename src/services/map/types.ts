import type { Place } from '../../types';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface MapAdapterDragMode {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

export type NetworkStatus = 'online' | 'offline';

export type MapAdapterError =
  | { kind: 'tile'; sourceId?: string; message: string }
  | { kind: 'geolocation'; message: string }
  | { kind: 'generic'; message: string };

export interface ResizeObserverLike {
  observe: (target: Element) => void;
  disconnect: () => void;
  unobserve?: (target: Element) => void;
}

export type ResizeObserverFactory = (callback: ResizeObserverCallback) => ResizeObserverLike;

export interface MapAdapterOptions {
  initialCenter?: GeoPoint;
  initialZoom?: number;
  theme?: 'light' | 'dark';
  onSelectPlace?: (placeId: string) => void;
  onClearSelection?: () => void;
  onMarkerButton?: (placeId: string, button: HTMLButtonElement | null) => void;
  onError?: (error: MapAdapterError) => void;
  onNetworkChange?: (online: boolean) => void;
  createResizeObserver?: ResizeObserverFactory;
}

export interface MapAdapter {
  mount(container: HTMLElement): void;
  destroy(): void;
  setPlaces(places: Place[], selectedPlaceId?: string | null): void;
  setSelectedPlaceId(placeId: string | null): void;
  setTheme(theme: 'light' | 'dark'): void;
  setDragMode(dragMode: MapAdapterDragMode | null): void;
  setNetworkStatus(status: NetworkStatus): void;
}
