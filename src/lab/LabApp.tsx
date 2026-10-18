import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { STATUS_META } from '../shared';
import { areaState, inBounds, type LabBounds, type LabContribution, type LabDraft, type LabPlace, type LabPlaceSheetProps } from './contract';
import { createLabStore } from './store';
import { LabViewport } from './LabViewport';
import { LabIntegrationSheet } from './LabIntegrationSheet';
import './lab.css';

// Integration-only seeds, not Claude's fixture file. No real institutions/ratings.
const seeds: LabPlace[] = [
  { id: 'demo-1', name: 'Демо: вход А (вымышленный)', lat: 43.0033, lng: 41.0237, status: 'green', steps_count: 0, step_height_cm: 0, door_width_cm: 95, ramp_type: 'none', toilet_exists: 'unknown', toilet_accessible: 'unknown', parking: 'yes', parking_accessible: 'unknown' },
  { id: 'demo-2', name: 'Демо: вход Б (вымышленный)', lat: 43.005, lng: 41.026, status: 'gray', steps_count: null, step_height_cm: null, door_width_cm: null, ramp_type: 'unknown', toilet_exists: 'unknown', toilet_accessible: 'unknown', parking: 'unknown', parking_accessible: 'unknown' },
];
const store = createLabStore();
const factLabels = { steps_count: 'Количество ступеней', step_height_cm: 'Высота ступени, см', door_width_cm: 'Ширина двери, см', ramp_type: 'Пандус', toilet_exists: 'Наличие туалета', toilet_accessible: 'Доступность туалета', parking: 'Наличие парковки', parking_accessible: 'Доступность парковки' };
const valueLabels: Record<string, string> = { yes: 'да', no: 'нет', unknown: 'неизвестно', partial: 'частично', none: 'нет', permanent: 'стационарный', portable_on_request: 'переносной по запросу', portable_available: 'переносной на месте' };
export function LabApp({ PlaceSheet = LabIntegrationSheet, fixtures = seeds }: { PlaceSheet?: ComponentType<LabPlaceSheetProps>; fixtures?: LabPlace[] }) {
  const [loaded] = useState(() => store.load());
  const [items, setItems] = useState<LabContribution[]>(loaded.items);
  const [message, setMessage] = useState(loaded.error ?? '');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [tab, setTab] = useState<'map' | 'mine'>('map');
  const [selected, select] = useState<string | null>(null);
  const [bounds, setBounds] = useState<LabBounds | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filter, setFilter] = useState('all');
  const places = [...fixtures, ...items.flatMap(item => item.kind === 'new-place' ? [item.place] : [])];
  const inViewport = bounds ? places.filter(place => inBounds(place, bounds)) : [];
  const filtered = places.filter(place => filter === 'all' || place.status === filter);
  const visible = inViewport.filter(place => filter === 'all' || place.status === filter);
  const state = areaState(phase, inViewport.length, visible.length);
  const place = places.find(item => item.id === selected);
  const onSelect = useCallback((id: string) => select(id), []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  function save(draft: LabDraft) {
    const result = store.save(draft);
    if (result.ok) setItems(result.items);
    setMessage(result.ok ? result.duplicate ? 'Эта отметка уже сохранена.' : 'Сохранено на устройстве. Не отправлено.' : result.error);
    return result;
  }
  function addDemo() {
    if (!bounds) return;
    const lat = (bounds.south + bounds.north) / 2;
    const lng = (bounds.west + bounds.east) / 2;
    const id = `lab-new-${lat.toFixed(6)}-${lng.toFixed(6)}`;
    const next: LabPlace = { ...seeds[1], id, name: 'Демо: новое непроверенное место', lat, lng, status: 'gray' };
    const result = save({ kind: 'new-place', placeId: id, placeName: next.name, place: next });
    if (result.ok) select(id);
  }
  return <main className="goapsny-lab">
    <h1>GoApsny · лаборатория</h1><p>Симуляция. Только вымышленные места. Все отметки остаются на этом устройстве; отправки нет.</p>
    <p>{online ? 'Сеть доступна' : 'Нет сети'} · локальное сохранение работает без сети.</p>
    <nav aria-label="Разделы лаборатории"><button aria-pressed={tab === 'map'} onClick={() => { setTab('map'); select(null); }}>Карта</button><button aria-pressed={tab === 'mine'} onClick={() => { setTab('mine'); select(null); }}>Мои отметки ({items.length})</button></nav>
    <p role="status" aria-live="polite">{message}</p>
    {tab === 'mine' ? <section aria-label="Мои отметки"><h2>Мои отметки</h2><p>Не отправлено: {items.length}. Это локальный журнал симуляции.</p>{!items.length && <p>Отметок пока нет.</p>}<ul>{items.map(item => <li key={item.id}>{item.placeName} · {item.kind === 'rating' ? `Предложение: ${STATUS_META[item.proposedStatus].ru}` : item.kind === 'problem' ? `Проблема: ${item.comment}` : item.kind === 'fact' ? `${factLabels[item.fact.field]}: ${item.fact.value === null ? 'неизвестно' : typeof item.fact.value === 'string' ? valueLabels[item.fact.value] : item.fact.value}` : 'Новое место, ещё не оценено'} · {new Date(item.createdAt).toLocaleString('ru')} · сохранено локально, не отправлено</li>)}</ul></section> : <>
      <label>Фильтр проверенного статуса<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Все</option>{Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.ru}</option>)}</select></label>
      <p>Демонстрационная координатная область без картографической подложки.</p>
      <LabViewport places={filtered} onSelect={onSelect} onBounds={setBounds} onPhase={setPhase} />
      <div role="status">{state === 'loading' ? 'Область загружается…' : state === 'error' ? 'Не удалось показать область карты. Пустота не означает отсутствие мест.' : state === 'empty-filter' ? 'В этой области нет мест по выбранному фильтру.' : state === 'empty-area' ? 'Здесь пока нет отметок — будьте первым.' : `В видимой области: ${visible.length}`}</div>
      {state === 'empty-filter' && <button onClick={() => setFilter('all')}>Сбросить фильтр</button>}
      {state === 'empty-area' && <button onClick={addDemo}>Добавить демонстрационное место в центре области</button>}
      <ul aria-label="Места для открытия карточки">{(state === 'error' ? filtered : visible).map(item => <li key={item.id}><button onClick={() => select(item.id)}>{item.name} · {STATUS_META[item.status].ru}</button></li>)}</ul>
      {place && <PlaceSheet key={place.id} place={place} onClose={() => select(null)} onSubmit={save} />}
    </>}
  </main>;
}
