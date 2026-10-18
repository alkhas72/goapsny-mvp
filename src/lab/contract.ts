import type { AccessibilityStatus, Place, RampType, ToiletAccessible, YesNoUnknown } from '../shared';

// Reuse production vocabulary; never infer an accessibility rating from a fact.
export type LabPlace = Pick<Place, 'id' | 'name' | 'lat' | 'lng' | 'status' | 'steps_count' | 'step_height_cm' | 'door_width_cm' | 'toilet_exists' | 'toilet_accessible' | 'parking'> & {
  ramp_type: RampType | 'unknown';
  parking_accessible: ToiletAccessible;
};
export type LabFact =
  | { field: 'steps_count' | 'step_height_cm' | 'door_width_cm'; value: number | null }
  | { field: 'ramp_type'; value: RampType | 'unknown' }
  | { field: 'parking' | 'toilet_exists'; value: YesNoUnknown }
  | { field: 'parking_accessible' | 'toilet_accessible'; value: ToiletAccessible };
export type LabPayload =
  | { kind: 'rating'; proposedStatus: Exclude<AccessibilityStatus, 'gray'> }
  | { kind: 'fact'; fact: LabFact }
  | { kind: 'problem'; problem: 'entrance' | 'information' | 'other'; comment: string }
  | { kind: 'new-place'; place: LabPlace };
export type LabContribution = LabPayload & {
  id: string; placeId: string; placeName: string; createdAt: string;
  state: 'local-only';
};
export type LabDraft = LabPayload & { placeId: string; placeName: string };
export type LabSaveResult = { ok: true; duplicate: boolean; items: LabContribution[] } | { ok: false; error: string };
export interface LabPlaceSheetProps {
  place: LabPlace;
  onClose: () => void;
  onSubmit: (draft: LabDraft) => LabSaveResult;
}
export interface LabBounds { west: number; south: number; east: number; north: number }
export function inBounds(place: LabPlace, bounds: LabBounds): boolean {
  return place.lat >= bounds.south && place.lat <= bounds.north &&
    (bounds.west <= bounds.east ? place.lng >= bounds.west && place.lng <= bounds.east : place.lng >= bounds.west || place.lng <= bounds.east);
}
export function areaState(phase: 'loading' | 'ready' | 'error', inViewport: number, afterFilter: number) {
  if (phase !== 'ready') return phase;
  return inViewport === 0 ? 'empty-area' : afterFilter === 0 ? 'empty-filter' : 'places';
}
