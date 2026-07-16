import type { Place } from '../../types';

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
