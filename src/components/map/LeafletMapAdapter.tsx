import { LeafletMap } from '../LeafletMap';
import type { MapViewProps } from './types';

export function LeafletMapAdapter(props: MapViewProps) {
  return <LeafletMap {...props} />;
}
