import { describe, expect, it } from 'vitest';
import type { LabDraft, LabPlace } from './contract';
import { createLabStore, LAB_STORAGE_KEY } from './store';

const rating: LabDraft = { kind: 'rating', placeId: 'demo', placeName: 'Демо', proposedStatus: 'red' };
const place: LabPlace = {
  id: 'new-demo', name: 'Новое демо', lat: 43, lng: 41, status: 'gray',
  steps_count: null, step_height_cm: null, door_width_cm: null,
  ramp_type: 'unknown', toilet_exists: 'unknown', toilet_accessible: 'unknown',
  parking: 'unknown', parking_accessible: 'unknown',
};
function persist(payload: Record<string, unknown>) {
  const raw = JSON.stringify({ version: 1, items: [{
    id: 'entry', placeId: 'demo', placeName: 'Демо',
    createdAt: '2026-10-18T12:00:00.000Z', state: 'local-only', ...payload,
  }] });
  localStorage.setItem(LAB_STORAGE_KEY, raw);
  return raw;
}
function expectRejected(raw: string) {
  expect(createLabStore().load().error).toBeTruthy();
  expect(createLabStore().save(rating).ok).toBe(false);
  expect(localStorage.getItem(LAB_STORAGE_KEY)).toBe(raw);
}

describe('lab storage validation regressions', () => {
  it('deduplicates equal rating payloads regardless of property order', () => {
    const store = createLabStore();
    expect(store.save(rating).ok).toBe(true);
    expect(store.save({ proposedStatus: 'red', placeName: 'Демо', placeId: 'demo', kind: 'rating' }))
      .toMatchObject({ ok: true, duplicate: true });
    expect(store.load().items).toHaveLength(1);
  });
  it('deduplicates equal nested fact payloads regardless of property order', () => {
    const store = createLabStore();
    expect(store.save({ kind: 'fact', placeId: 'demo', placeName: 'Демо', fact: { field: 'steps_count', value: 0 } }).ok).toBe(true);
    expect(store.save({ fact: { value: 0, field: 'steps_count' }, placeName: 'Демо', placeId: 'demo', kind: 'fact' }))
      .toMatchObject({ ok: true, duplicate: true });
    expect(store.load().items).toHaveLength(1);
  });
  it('persists and reloads a complete unknown gray place', () => {
    const store = createLabStore();
    expect(store.save({ kind: 'new-place', placeId: place.id, placeName: place.name, place }).ok).toBe(true);
    expect(createLabStore().load()).toMatchObject({ error: null, items: [{ kind: 'new-place', place }] });
  });
  it.each([
    ['missing facts', { id: place.id, name: place.name, lat: 43, lng: 41, status: 'gray' }],
    ['invalid ramp', { ...place, ramp_type: 'yes' }],
    ['invalid parking presence', { ...place, parking: 'partial' }],
    ['invalid toilet accessibility', { ...place, toilet_accessible: 'maybe' }],
    ['fractional steps', { ...place, steps_count: 0.5 }],
    ['negative width', { ...place, door_width_cm: -1 }],
  ])('preserves and rejects new-place data with %s', (_label, invalidPlace) => {
    expectRejected(persist({ kind: 'new-place', placeId: place.id, placeName: place.name, place: invalidPlace }));
  });
  it.each([
    ['rating enum array', { kind: 'rating', proposedStatus: ['green'] }],
    ['problem enum array', { kind: 'problem', problem: ['entrance'], comment: 'Демо' }],
    ['fact field array', { kind: 'fact', fact: { field: ['steps_count'], value: 0.5 } }],
    ['fact enum array', { kind: 'fact', fact: { field: 'parking', value: ['yes'] } }],
  ])('rejects untrusted JSON containing %s', (_label, payload) => {
    expectRejected(persist(payload));
  });
  it('handles a null envelope without throwing or overwriting it', () => {
    localStorage.setItem(LAB_STORAGE_KEY, 'null');
    expect(() => createLabStore().load()).not.toThrow();
    expectRejected('null');
  });
});
