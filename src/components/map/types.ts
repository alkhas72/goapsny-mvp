import type { Place } from '../../types';

/**
 * Props/events for the map-component boundary. Deliberately mirrors
 * `LeafletMapProps` (see `src/components/LeafletMap.tsx`) so the adapter can
 * replace Leaflet behind the same surface without touching the shell.
 *
 * Do not widen without coordinating with the Leaflet contract.
 */
export interface MapViewProps {
  places: Place[];
  selectedPlaceId: string | null;
  theme: 'dark' | 'light';
  onSelectPlace?: (id: string) => void;
  onClearSelection?: () => void;
  dragMode?: {
    lat: number;
    lng: number;
    onChange: (lat: number, lng: number) => void;
  };
  useBrowserGeolocation?: boolean;
  onMarkerButton?: (placeId: string, button: HTMLButtonElement | null) => void;
}
