import type { LabContribution, LabDraft, LabSaveResult } from './contract';
export const LAB_STORAGE_KEY = 'goapsny.lab.contributions.v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const failure = 'Не удалось сохранить на устройстве. Запись не сохранена; повторите попытку.';

const enumValue = (value: unknown, options: readonly string[]) => typeof value === 'string' && options.includes(value);
const presence = ['yes', 'no', 'unknown'];
const accessibility = [...presence, 'partial'];
const ramps = ['none', 'permanent', 'portable_on_request', 'portable_available', 'unknown'];
const measurement = (value: unknown, integer = false) => value === null ||
  (typeof value === 'number' && Number.isFinite(value) && value >= 0 && (!integer || Number.isInteger(value)));
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

// Validate all promised fields before handing persisted data to the card.
function isItem(value: unknown): value is LabContribution {
  if (!record(value)) return false;
  const v = value;
  if (typeof v.id !== 'string' || typeof v.placeId !== 'string' || typeof v.placeName !== 'string' ||
      typeof v.createdAt !== 'string' || !Number.isFinite(Date.parse(v.createdAt)) || v.state !== 'local-only') return false;
  if (v.kind === 'rating') return enumValue(v.proposedStatus, ['green', 'yellow', 'red']);
  if (v.kind === 'problem') return enumValue(v.problem, ['entrance', 'information', 'other']) && typeof v.comment === 'string';
  if (v.kind === 'fact' && record(v.fact)) {
    const f = v.fact;
    if (enumValue(f.field, ['steps_count', 'step_height_cm', 'door_width_cm'])) return measurement(f.value, f.field === 'steps_count');
    const values = f.field === 'ramp_type' ? ramps :
      enumValue(f.field, ['toilet_accessible', 'parking_accessible']) ? accessibility :
      enumValue(f.field, ['parking', 'toilet_exists']) ? presence : [];
    return enumValue(f.value, values);
  }
  if (v.kind === 'new-place' && record(v.place)) {
    const p = v.place;
    return p.id === v.placeId && p.name === v.placeName && p.status === 'gray' &&
      typeof p.lat === 'number' && Math.abs(p.lat) <= 90 && typeof p.lng === 'number' && Math.abs(p.lng) <= 180 &&
      measurement(p.steps_count, true) && measurement(p.step_height_cm) && measurement(p.door_width_cm) &&
      enumValue(p.ramp_type, ramps) && enumValue(p.toilet_exists, presence) && enumValue(p.parking, presence) &&
      enumValue(p.toilet_accessible, accessibility) && enumValue(p.parking_accessible, accessibility);
  }
  return false;
}
// Canonicalize recursively: equivalent cards may construct object keys in any order.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function fingerprint(entry: LabContribution): string {
  const { placeId, kind } = entry;
  const payload = kind === 'rating' ? { proposedStatus: entry.proposedStatus } :
    kind === 'fact' ? { fact: entry.fact } : kind === 'problem' ? { problem: entry.problem, comment: entry.comment } : { place: entry.place };
  return JSON.stringify(canonical({ placeId, kind, ...payload }));
}
export function createLabStore(storage: () => StoragePort = () => window.localStorage) {
  function load(): { items: LabContribution[]; error: string | null } {
    try {
      const raw = storage().getItem(LAB_STORAGE_KEY);
      if (!raw) return { items: [], error: null };
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.items) || !data.items.every(isItem)) throw new Error('invalid');
      return { items: data.items, error: null };
    } catch { return { items: [], error: 'Не удалось прочитать локальные отметки. Сохранённые данные не перезаписаны.' }; }
  }
  function save(draft: LabDraft): LabSaveResult {
    const loaded = load();
    if (loaded.error) return { ok: false, error: loaded.error };
    const item: LabContribution = { ...draft, id: crypto.randomUUID(), createdAt: new Date().toISOString(), state: 'local-only' };
    if (!isItem(item)) return { ok: false, error: 'Проверьте введённые данные.' };
    if (loaded.items.some(entry => fingerprint(entry) === fingerprint(item))) return { ok: true, duplicate: true, items: loaded.items };
    const items = [...loaded.items, item];
    try {
      const encoded = JSON.stringify({ version: 1, items });
      storage().setItem(LAB_STORAGE_KEY, encoded);
      if (storage().getItem(LAB_STORAGE_KEY) !== encoded) throw new Error('write verification');
      return { ok: true, duplicate: false, items };
    } catch { return { ok: false, error: failure }; }
  }
  return { load, save };
}
