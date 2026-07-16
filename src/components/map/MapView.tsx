import { resolveMapEngine } from './mapEngine';
import { LeafletMapAdapter } from './LeafletMapAdapter';
import { MapLibreMap } from './MapLibreMap';
import type { MapViewProps } from './types';

export interface MapViewComponentProps extends MapViewProps {
  engine?: ReturnType<typeof resolveMapEngine>;
}

export function MapView({ engine = resolveMapEngine(), ...props }: MapViewComponentProps) {
  if (engine === 'maplibre') {
    return <MapLibreMap {...props} />;
  }
  return <LeafletMapAdapter {...props} />;
}
