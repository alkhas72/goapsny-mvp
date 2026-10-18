import type { LabContribution, LabDraft, LabSaveResult } from './contract';
export const LAB_STORAGE_KEY = 'goapsny.lab.contributions.v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const failure = 'Не удалось сохранить на устройстве. Запись не сохранена; повторите попытку.';

// Validate untrusted persisted data before rendering or accepting another write.
function isItem(value: unknown): value is LabContribution {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.placeId !== 'string' || typeof v.placeName !== 'string' ||
      typeof v.createdAt !== 'string' || !Number.isFinite(Date.parse(v.createdAt)) || v.state !== 'local-only') return false;
  if (v.kind === 'rating') return ['green', 'yellow', 'red'].includes(String(v.proposedStatus));
  if (v.kind === 'problem') return ['entrance', 'information', 'other'].includes(String(v.problem)) && typeof v.comment === 'string';
  if (v.kind === 'fact' && v.fact && typeof v.fact === 'object') {
    const f = v.fact as Record<string, unknown>;
    if (['steps_count', 'step_height_cm', 'door_width_cm'].includes(String(f.field))) return f.value === null || (typeof f.value === 'number' && Number.isFinite(f.value) && f.value >= 0 && (f.field !== 'steps_count' || Number.isInteger(f.value)));
    const values = f.field === 'ramp_type' ? ['none', 'permanent', 'portable_on_request', 'portable_available', 'unknown'] :
      ['toilet_accessible', 'parking_accessible'].includes(String(f.field)) ? ['yes', 'no', 'partial', 'unknown'] :
      ['parking', 'toilet_exists'].includes(String(f.field)) ? ['yes', 'no', 'unknown'] : [];
    return values.includes(String(f.value));
  }
  if (v.kind === 'new-place' && v.place && typeof v.place === 'object') {
    const p = v.place as Record<string, unknown>;
    return p.id === v.placeId && typeof p.name === 'string' && p.status === 'gray' &&
      typeof p.lat === 'number' && Math.abs(p.lat) <= 90 && typeof p.lng === 'number' && Math.abs(p.lng) <= 180;
  }
  return false;
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
    const fingerprint = (entry: LabContribution) => JSON.stringify(Object.fromEntries(Object.entries(entry).filter(([key]) => !['id', 'createdAt', 'state'].includes(key))));
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
