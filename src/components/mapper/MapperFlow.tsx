import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  CloudOff,
  Image as ImageIcon,
  Minus,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RampType } from '../../shared/index';
import { CATEGORIES } from '../../shared/index';
import {
  submitMapperPlace,
  type SubmitMapperPlaceInput,
  type SubmitMapperPlaceResult,
} from '../../services/submit-mapper-place';
import { canWait, getMapperOutbox, isOffline, outboxReason, type MapperOutbox, type OutboxReason } from '../../services/mapper-outbox';
import { SubmitPlaceError } from '../../services/submit-place';
import { getBrowserLocation } from '../../utils/location';
import { holdPhotoInMemory, prepareFacadePhoto } from '../../utils/photo';
import { MapLibreMap } from '../map/MapLibreMap';
import {
  EMPTY_FACTS,
  factsFromDraft,
  SUBTYPES,
  suggestStatus,
  type EntranceFacts,
  type YesNoUnknown,
} from './assistant';
import { appendDay, type DayEntry } from './dayLog';
import { demoEyes, type AssistantEyes } from './eyes';
import { keptText, sendErrorText } from './sendError';

interface MapperFlowProps {
  theme: 'light' | 'dark';
  /** Fallback point when the phone gives no location: the map centre. */
  getCenter: () => { lat: number; lng: number } | null;
  eyes?: AssistantEyes;
  /** Отправка на сервер; подменяется в тестах. */
  submit?: (input: SubmitMapperPlaceInput) => Promise<SubmitMapperPlaceResult>;
  /**
   * Кто вошёл (auth.uid()). С ним объект при сбое связи остаётся на устройстве
   * и уходит позже; без него отказ просто показывается на экране.
   */
  ownerId?: string | null;
  /** Отложенная отправка; подменяется в тестах. */
  outbox?: Pick<MapperOutbox, 'add'>;
  onClose: () => void;
  onSaved: (entries: DayEntry[]) => void;
  onOpenDay: () => void;
  onAnother: () => void;
}

type Step = 1 | 2 | 3 | 4 | 'done';

const STEP_NAME: Record<1 | 2 | 3 | 4, string> = {
  1: 'Фото входа',
  2: 'Данные',
  3: 'Доступность',
  4: 'Точка на карте',
};

const MAX_PHOTOS = 5;

const RAMP_LABEL: Record<RampType, string> = {
  none: 'Нет',
  permanent: 'Постоянный',
  portable_available: 'Приставной, на месте',
  portable_on_request: 'Приставной, по просьбе',
};

const STATUS_CARD = {
  green: { title: 'Доступно', text: 'вход без барьеров' },
  yellow: { title: 'Частично', text: 'въезд есть, но с ограничениями' },
  red: { title: 'Недоступно', text: 'входная группа недоступна' },
} as const;

type Light = keyof typeof STATUS_CARD;

function AiMark({ on }: { on: boolean }) {
  if (!on) return null;
  return <Sparkles className="ai-mark" size={14} aria-label="заполнено по фото" />;
}

function Seg({
  value,
  onChange,
  label,
}: {
  value: YesNoUnknown;
  onChange: (v: YesNoUnknown) => void;
  label: string;
}) {
  const opts: [YesNoUnknown, string][] = [
    ['yes', 'Да'],
    ['no', 'Нет'],
    ['unknown', 'Не знаю'],
  ];
  return (
    <div className="nf-seg" role="group" aria-label={label}>
      {opts.map(([v, t]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {t}
        </button>
      ))}
    </div>
  );
}

/**
 * «Новый объект» — full screen, four steps after the approved GoApsny canon
 * (02.07): photo → data (the assistant fills from the photo, the mapper
 * checks and measures) → traffic light → point. The point is taken when the
 * photo is taken; step 4 only refines it by dragging.
 */
export function MapperFlow({
  theme,
  getCenter,
  eyes = demoEyes,
  submit = submitMapperPlace,
  ownerId = null,
  outbox,
  onClose,
  onSaved,
  onOpenDay,
  onAnother,
}: MapperFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [looking, setLooking] = useState(false);
  const [aiFields, setAiFields] = useState<Set<keyof EntranceFacts>>(new Set());
  const [facts, setFacts] = useState<EntranceFacts>(EMPTY_FACTS);
  const [pickCategory, setPickCategory] = useState(false);
  const [light, setLight] = useState<Light | null>(null);
  const [saved, setSaved] = useState<DayEntry[] | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Объект не ушёл, но сохранён на устройстве: причина, по которой он ждёт.
  const [kept, setKept] = useState<OutboxReason | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  const suggestion = useMemo(() => suggestStatus(facts), [facts]);
  const category = CATEGORIES.find((c) => c.slug === facts.category) ?? null;

  useEffect(
    () => () => photos.forEach((p) => URL.revokeObjectURL(p.url)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke once on unmount
    [],
  );

  const set = (patch: Partial<EntranceFacts>) => {
    setFacts((f) => ({ ...f, ...patch }));
    setAiFields((prev) => {
      const next = new Set(prev);
      (Object.keys(patch) as (keyof EntranceFacts)[]).forEach((k) => next.delete(k));
      return next;
    });
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const first = photos.length === 0;
    const picked = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    // Снимок сразу читаем в память: к шагу 4 временный файл камеры на iPhone
    // может уже не читаться. Не прочитался сейчас: оставляем как есть,
    // понятный отказ даст подготовка фото перед отправкой.
    const held = await Promise.all(picked.map((file) => holdPhotoInMemory(file).catch(() => file)));
    const added = held.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPhotos((p) => [...p, ...added]);
    if (!first) return;
    // The point is fixed when the entrance is photographed.
    getBrowserLocation()
      .then(setPoint)
      .catch(() => setPoint(getCenter()));
    setLooking(true);
    eyes
      .look(added[0].file)
      .then((draft) => {
        setFacts(factsFromDraft(draft));
        const seen = new Set<keyof EntranceFacts>();
        if (draft.name) seen.add('name');
        if (draft.category) seen.add('category');
        if (draft.subtype) seen.add('subtype');
        if (draft.stepsVisible != null) seen.add('steps');
        if (draft.ramp) seen.add('ramp');
        setAiFields(seen);
      })
      .catch(() => undefined)
      .finally(() => setLooking(false));
  };

  const goTo = (next: Step) => {
    if (next === 3 && light == null) setLight(suggestion.status);
    setStep(next);
  };

  const canNext =
    step === 1 ? photos.length > 0 : step === 2 ? facts.name.trim().length > 0 && !!facts.category : step === 3 ? !!light : !!point;

  // Объект считается добавленным только после ответа сервера: карточка уходит
  // на проверку, и лишь тогда появляется строка в «Сегодня».
  const save = async () => {
    if (!light || !point || !facts.category || photos.length === 0 || sending) return;
    setSending(true);
    setSendError(null);
    let input: SubmitMapperPlaceInput | null = null;
    try {
      const photo = await prepareFacadePhoto(photos[0].file);
      input = {
        name: facts.name.trim(),
        category: facts.category,
        lat: point.lat,
        lng: point.lng,
        photo,
        status: light,
        stepsCount: facts.steps,
        rampType: facts.ramp,
        subtype: facts.subtype,
        stepHigh: facts.stepHigh,
        doorWide: facts.doorWide,
      };
      // Без сети запрос провисел бы до таймаута: сразу идём в отложенные.
      if (ownerId && isOffline()) throw new SubmitPlaceError('unknown', 'Device is offline');
      await submit(input);
      const fullCard = facts.steps != null && facts.doorWide !== 'unknown' && facts.ramp != null;
      const entries = appendDay(
        {
          name: facts.name.trim() || facts.subtype || 'Без названия',
          subtype: facts.subtype,
          status: light,
          reason: light === suggestion.status ? suggestion.reason : 'светофор поставил картограф',
          // На сервер уходит одно фото входа — столько же и в счёте.
          photos: 1,
        },
        fullCard,
      );
      setSaved(entries);
      onSaved(entries);
      setStep('done');
    } catch (error) {
      // Связь, вход или сервер: карточка в порядке, держим её на устройстве.
      if (input && ownerId && canWait(error)) {
        const reason = outboxReason(error);
        try {
          await (outbox ?? getMapperOutbox()).add(ownerId, input, reason);
          setKept(reason);
          setStep('done');
          return;
        } catch {
          // Хранилище устройства недоступно: остаётся прежний путь с повтором.
        }
      }
      setSendError(sendErrorText(error));
    } finally {
      setSending(false);
    }
  };

  const back = () => {
    if (sending) return;
    setSendError(null);
    if (step === 1 || step === 'done') onClose();
    else setStep((step - 1) as Step);
  };

  if (pickCategory) {
    return createPortal(
      <div className="nf-screen" role="dialog" aria-modal="true" aria-label="Категория">
        <header className="nf-top is-final">
          <button type="button" aria-label="Назад" onClick={() => setPickCategory(false)}>
            <ArrowLeft size={22} />
          </button>
          <span>Категория</span>
        </header>
        <ul className="nf-cat-list">
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              <button
                type="button"
                className={c.slug === facts.category ? 'is-on' : ''}
                onClick={() => {
                  set({ category: c.slug, subtype: null });
                  setPickCategory(false);
                }}
              >
                {c.ru}
                {c.slug === facts.category && <Check size={20} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </div>,
      document.body,
    );
  }

  // Full screen over the whole app: the map has done its job.
  return createPortal(
    <div className="nf-screen" role="dialog" aria-modal="true" aria-label="Новый объект">
      <header className="nf-top">
        <button type="button" aria-label="Назад" onClick={back}>
          <ArrowLeft size={22} />
        </button>
        <span>Новый объект</span>
        <button type="button" aria-label="Закрыть" onClick={onClose}>
          <X size={22} />
        </button>
      </header>

      {step !== 'done' && (
        <div className="nf-progress">
          <div className="nf-bars" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <i key={i} className={i <= step ? 'on' : ''} />
            ))}
          </div>
          <p>
            <b>Шаг {step} из 4</b> · {STEP_NAME[step]}
          </p>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
        const input = e.target;
        // Поле очищаем после чтения: до него файл должен оставаться живым.
        void addPhotos(input.files).finally(() => {
          input.value = '';
        });
      }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => {
        const input = e.target;
        void addPhotos(input.files).finally(() => {
          input.value = '';
        });
      }} />

      {step === 1 && (
        <div className="nf-body nf-photo-step">
          {photos.length === 0 ? (
            <button type="button" className="nf-drop" onClick={() => cameraRef.current?.click()}>
              <Camera size={48} strokeWidth={1.6} aria-hidden="true" />
              Сфотографируйте вход
            </button>
          ) : (
            <>
              <img className="nf-photo-main" src={photos[photos.length - 1].url} alt="Фото входа" />
              <div className="nf-thumbs">
                {photos.map((p, i) => (
                  <img key={p.url} src={p.url} alt={`Фото ${i + 1}`} />
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button type="button" aria-label="Ещё фото" onClick={() => cameraRef.current?.click()}>
                    <Plus size={22} />
                  </button>
                )}
              </div>
              {photos.length > 1 && (
                <p className="nf-hint">В карточку уйдёт первое фото. Остальные пока не сохраняются.</p>
              )}
            </>
          )}
          {photos.length === 0 && (
            <div className="nf-two">
              <button type="button" className="nf-btn is-work" onClick={() => cameraRef.current?.click()}>
                <Camera size={18} aria-hidden="true" /> Камера
              </button>
              <button type="button" className="nf-btn is-ghost" onClick={() => galleryRef.current?.click()}>
                <ImageIcon size={18} aria-hidden="true" /> Галерея
              </button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="nf-body">
          <div className="nf-ai-row">
            {photos[0] && <img src={photos[0].url} alt="" />}
            <span className={`nf-pill${looking ? ' is-busy' : ''}`}>
              <Sparkles size={14} aria-hidden="true" />
              {looking ? 'ИИ смотрит фото…' : 'ИИ распознал по фото'}
            </span>
          </div>

          <label className="nf-label" htmlFor="nf-name">
            Название <AiMark on={aiFields.has('name')} />
          </label>
          <input
            id="nf-name"
            className="nf-input"
            value={facts.name}
            onChange={(e) => set({ name: e.target.value })}
          />

          <span className="nf-label">
            Категория <AiMark on={aiFields.has('category')} />
          </span>
          <button type="button" className="nf-input nf-select" onClick={() => setPickCategory(true)}>
            {category ? category.ru : 'Выбрать'} <ChevronDown size={18} aria-hidden="true" />
          </button>
          {facts.category && (
            <div className="nf-chips" role="group" aria-label="Тип объекта">
              {(SUBTYPES[facts.category] ?? []).map((t) => (
                <button key={t} type="button" aria-pressed={t === facts.subtype} onClick={() => set({ subtype: t })}>
                  {t}
                </button>
              ))}
            </div>
          )}

          <div className="nf-row2">
            <div>
              <span className="nf-label">
                Ступени <AiMark on={aiFields.has('steps')} />
              </span>
              <div className="nf-stepper" role="group" aria-label="Ступени">
                <button type="button" aria-label="Меньше" onClick={() => set({ steps: Math.max(0, (facts.steps ?? 0) - 1) })}>
                  <Minus size={18} />
                </button>
                <output>{facts.steps ?? 0}</output>
                <button type="button" aria-label="Больше" onClick={() => set({ steps: (facts.steps ?? 0) + 1 })}>
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div>
              <span className="nf-label">
                Пандус <AiMark on={aiFields.has('ramp')} />
              </span>
              <select
                className="nf-input"
                value={facts.ramp ?? ''}
                onChange={(e) => set({ ramp: (e.target.value || null) as RampType | null })}
              >
                <option value="">—</option>
                {(Object.keys(RAMP_LABEL) as RampType[]).map((r) => (
                  <option key={r} value={r}>
                    {RAMP_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(facts.steps ?? 0) > 0 && (
            <>
              <span className="nf-label">Ступень выше 5 см</span>
              <Seg label="Ступень выше 5 см" value={facts.stepHigh} onChange={(v) => set({ stepHigh: v })} />
            </>
          )}
          <span className="nf-label">Дверь шире 80 см</span>
          <Seg label="Дверь шире 80 см" value={facts.doorWide} onChange={(v) => set({ doorWide: v })} />

          <p className="nf-hint">Проверьте и поправьте — ИИ мог ошибиться</p>
        </div>
      )}

      {step === 3 && (
        <div className="nf-body">
          {(['green', 'yellow', 'red'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`nf-status is-${s}`}
              aria-pressed={light === s}
              onClick={() => setLight(s)}
            >
              <span className="nf-dot" aria-hidden="true" />
              <span className="nf-status-text">
                <b>{STATUS_CARD[s].title}</b>
                {s === suggestion.status ? suggestion.reason : STATUS_CARD[s].text}
              </span>
              {light === s && <Check className="nf-check" size={22} aria-hidden="true" />}
            </button>
          ))}
          <p className="nf-hint">
            <Sparkles size={13} aria-hidden="true" /> Предложено по данным входа
            {suggestion.unchecked.length > 0 && ` · не проверено: ${suggestion.unchecked.join(', ')}`}
          </p>
        </div>
      )}

      {step === 4 && (
        <div className="nf-body nf-map-step">
          <div className="nf-map">
            {point ? (
              <MapLibreMap
                places={[]}
                selectedPlaceId={null}
                theme={theme}
                dragMode={{ lat: point.lat, lng: point.lng, onChange: (lat, lng) => setPoint({ lat, lng }) }}
              />
            ) : (
              <p className="nf-hint">Определяем место…</p>
            )}
            <span className="nf-map-note">Перетащите пин ко входу</span>
          </div>
        </div>
      )}

      {step === 'done' && saved && (
        <div className="nf-body nf-done">
          <span className="nf-done-mark">
            <Check size={40} aria-hidden="true" />
          </span>
          <h2>{facts.name || 'Объект'} — на проверке</h2>
          <p className="nf-hint">Модератор посмотрит карточку, и объект появится на карте.</p>
          <p className="nf-karma">+{saved[saved.length - 1].karma} кармы</p>
          <p className="nf-hint">Сегодня добавлено: {saved.length}</p>
          <button type="button" className="nf-btn is-work" onClick={onAnother}>
            Ещё объект
          </button>
          <button type="button" className="nf-btn is-ghost" onClick={onOpenDay}>
            Кабинет
          </button>
        </div>
      )}

      {step === 'done' && kept && (
        <div className="nf-body nf-done is-kept">
          <span className="nf-done-mark">
            <CloudOff size={38} aria-hidden="true" />
          </span>
          <h2>{facts.name || 'Объект'} — сохранён на устройстве</h2>
          <p className="nf-hint">{keptText(kept)}</p>
          <p className="nf-hint">Объекты, которые ждут отправки, видны в кабинете.</p>
          <button type="button" className="nf-btn is-work" onClick={onAnother}>
            Ещё объект
          </button>
          <button type="button" className="nf-btn is-ghost" onClick={onOpenDay}>
            Кабинет
          </button>
        </div>
      )}

      {step !== 'done' && (step !== 1 || photos.length > 0) && (
        <footer className="nf-foot">
          {step === 4 && sendError && (
            <p className="nf-send-error" role="alert">
              {sendError}
            </p>
          )}
          {step === 4 ? (
            <button
              type="button"
              className="nf-btn is-final"
              disabled={!canNext || sending}
              aria-busy={sending}
              onClick={() => void save()}
            >
              <Check size={18} aria-hidden="true" />
              {sending ? 'Отправляем…' : sendError ? 'Повторить отправку' : 'Отправить на проверку'}
            </button>
          ) : (
            <button type="button" className="nf-btn is-work" disabled={!canNext} onClick={() => goTo((step + 1) as Step)}>
              Далее
            </button>
          )}
        </footer>
      )}
    </div>,
    document.body,
  );
}
