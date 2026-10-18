import { describe, expect, it } from 'vitest';
import { createLabStore, LAB_STORAGE_KEY } from './store';
import { areaState, inBounds, type LabDraft, type LabPlace } from './contract';
import { isLabMode } from './entry';
const draft: LabDraft = { kind: 'rating', placeId: 'demo', placeName: 'Демо', proposedStatus: 'red' };
describe('lab persistence', () => {
  it('persists full payload across reloads and days, deduplicates repeated submit', () => {
    const store = createLabStore();
    expect(store.save(draft).ok).toBe(true);
    expect(createLabStore().load().items[0]).toMatchObject({ ...draft, state: 'local-only' });
    expect(createLabStore().save(draft)).toMatchObject({ ok: true, duplicate: true });
    expect(store.load().items).toHaveLength(1);
    expect(store.save({ ...draft, proposedStatus: 'yellow' }).ok).toBe(true);
    expect(store.load().items).toHaveLength(2);
  });
  it('reports quota and disabled storage without claiming success', () => {
    expect(createLabStore(() => ({ getItem: () => null, setItem: () => { throw new Error('quota'); } })).save(draft).ok).toBe(false);
    expect(createLabStore(() => { throw new Error('disabled'); }).load().error).toBeTruthy();
    expect(createLabStore(() => ({ getItem: () => null, setItem: () => {} })).save(draft).ok).toBe(false);
  });
  it('preserves corrupt and future-version data rather than overwriting', () => {
    for (const raw of ['{', '{"version":2,"items":[]}', '{"version":1,"items":[{}]}']) {
      localStorage.setItem(LAB_STORAGE_KEY, raw);
      expect(createLabStore().save(draft).ok).toBe(false);
      expect(localStorage.getItem(LAB_STORAGE_KEY)).toBe(raw);
    }
  });
  it('keeps zero, unknown and no distinct; rejects invalid measurements', () => {
    const store = createLabStore();
    for (const value of [0, null, 90]) expect(store.save({ kind: 'fact', placeId: 'demo', placeName: 'Демо', fact: { field: 'door_width_cm', value } }).ok).toBe(true);
    expect(store.save({ kind: 'fact', placeId: 'demo', placeName: 'Демо', fact: { field: 'door_width_cm', value: -1 } }).ok).toBe(false);
    expect(store.load().items).toHaveLength(3);
  });
});
describe('lab routing and viewport', () => {
  it('requires exact lab flag and wins independently of other entrances', () => {
    for (const query of ['?lab=1', '?mapper=1&lab=1&tgWebAppData=demo']) expect(isLabMode(query)).toBe(true);
    for (const query of ['', '?lab=true', '?lab=10', '?lab=0']) expect(isLabMode(query)).toBe(false);
  });
  it('distinguishes filter emptiness, area emptiness, loading and errors', () => {
    expect(areaState('loading', 0, 0)).toBe('loading');
    expect(areaState('error', 0, 0)).toBe('error');
    expect(areaState('ready', 0, 0)).toBe('empty-area');
    expect(areaState('ready', 1, 0)).toBe('empty-filter');
    expect(areaState('ready', 1, 1)).toBe('places');
    const p = { lat: 43, lng: 41 } as LabPlace;
    expect(inBounds(p, { south: 42, north: 44, west: 40, east: 42 })).toBe(true);
    expect(inBounds(p, { south: 44, north: 45, west: 40, east: 42 })).toBe(false);
  });
});
