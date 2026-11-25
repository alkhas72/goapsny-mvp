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
import type { RampType, ToiletAccessible } from '../../shared/index';
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
  amenitiesTouched,
  DOOR_WIDTH_RANGE,
  doorWideOf,
  EMPTY_AMENITIES,
  EMPTY_FACTS,
  factsFromDraft,
  MAX_TOILET_PHOTOS,
  parseCm,
  STEP_HEIGHT_RANGE,
  stepHighOf,
  SUBTYPES,
  suggestStatus,
  TOILET_NOTE_MAX,
  type Amenities,
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

type Step = 1 | 2 | 3 | 4 | 5 | 'done';

const STEP_NAME: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Фото входа',
  2: 'Данные',
  3: 'Доступность',
  4: 'Туалет и удобства',
  5: 'Точка на карте',
};

const STEPS = [1, 2, 3, 4, 5] as const;
const LAST_STEP = 5;

const MAX_PHOTOS = 5;

const RAMP_LABEL: Record<RampType, string> = {
  none: 'Нет',
  permanent: 'Постоянный',
  portable_available: 'Приставной, на месте',
  portable_on_request: 'Приставной, по просьбе',
  lift: 'Подъёмник',
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

const YES_NO: [YesNoUnknown, string][] = [
  ['yes', 'Да'],
  ['no', 'Нет'],
];

/**
 * Отметка без обязательного ответа: ничего не выбрано — «не знаю», шаг
 * пропускается. Повторное нажатие снимает ответ.
 */
function Pick<T extends string>({
  value,
  onChange,
  label,
  options,
  none,
}: {
  value: T;
  onChange: (v: T) => void;
  label: string;
  options: [T, string][];
  /** Значение «ничего не выбрано». */
  none: T;
}) {
  return (
    <div className="nf-seg" role="group" aria-label={label}>
      {options.map(([v, t]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(value === v ? none : v)}>
          {t}
        </button>
      ))}
    </div>
  );
}

/**
 * «Новый объект» — full screen, five steps: photo → data (the assistant fills
 * from the photo, the mapper checks and measures) → traffic light → toilet
 * and amenities (25.11, the whole step can be skipped) → point. The point is
 * taken when the photo is taken; the last step only refines it by dragging.
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
  // Сантиметры держим текстом, пока человек печатает; в факты идёт число.
  const [stepText, setStepText] = useState('');
  const [doorText, setDoorText] = useState('');
  const [amenities, setAmenities] = useState<Amenities>(EMPTY_AMENITIES);
  const [toiletPhotos, setToiletPhotos] = useState<{ file: File; url: string }[]>([]);
  const [noteByAi, setNoteByAi] = useState(false);
  const [describing, setDescribing] = useState(false);
  // Карточка ушла, а фото туалета сервер не взял: говорим об этом прямо.
  const [toiletLost, setToiletLost] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const toiletRef = useRef<HTMLInputElement | null>(null);
  const toiletUrls = useRef<string[]>([]);
  const noteRef = useRef('');
  noteRef.current = amenities.toiletNote;

  const suggestion = useMemo(() => suggestStatus(facts), [facts]);
  const category = CATEGORIES.find((c) => c.slug === facts.category) ?? null;

  useEffect(
    () => () => {
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      toiletUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
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
        setStepText(draft.stepHeightCm != null ? String(draft.stepHeightCm) : '');
        setDoorText(draft.doorWidthCm != null ? String(draft.doorWidthCm) : '');
        const seen = new Set<keyof EntranceFacts>();
        if (draft.name) seen.add('name');
        if (draft.category) seen.add('category');
        if (draft.subtype) seen.add('subtype');
        if (draft.stepsVisible != null) seen.add('steps');
        if (draft.ramp) seen.add('ramp');
        if (draft.stepHeightCm != null) seen.add('stepHeightCm');
        if (draft.doorWidthCm != null) seen.add('doorWidthCm');
        setAiFields(seen);
      })
      .catch(() => undefined)
      .finally(() => setLooking(false));
  };

  const addToiletPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const first = toiletPhotos.length === 0;
    const picked = Array.from(files).slice(0, MAX_TOILET_PHOTOS - toiletPhotos.length);
    const held = await Promise.all(picked.map((file) => holdPhotoInMemory(file).catch(() => file)));
    const added = held.map((file) => ({ file, url: URL.createObjectURL(file) }));
    toiletUrls.current.push(...added.map((a) => a.url));
    setToiletPhotos((p) => [...p, ...added]);
    // Помощник описывает первое фото, если человек сам ещё ничего не написал.
    if (!first || added.length === 0 || !eyes.describeToilet || amenities.toiletNote.trim()) return;
    setDescribing(true);
    eyes
      .describeToilet(added[0].file)
      .then((note) => {
        // Человек успел написать сам: его слова важнее.
        if (!note || noteRef.current.trim()) return;
        setAmenities((a) => ({ ...a, toiletNote: note.slice(0, TOILET_NOTE_MAX) }));
        setNoteByAi(true);
      })
      .catch(() => undefined)
      .finally(() => setDescribing(false));
  };

  const removeToiletPhoto = (url: string) => setToiletPhotos((p) => p.filter((x) => x.url !== url));

  const setAmenity = (patch: Partial<Amenities>) => setAmenities((a) => ({ ...a, ...patch }));

  const goTo = (next: Step) => {
    if (next === 3 && light == null) setLight(suggestion.status);
    setStep(next);
  };

  const canNext =
    step === 1
      ? photos.length > 0
      : step === 2
        ? facts.name.trim().length > 0 && !!facts.category
        : step === 3
          ? !!light
          : step === 4
            ? true
            : !!point;
  const hasToiletPhotos = amenities.toilet === 'yes' ? toiletPhotos.length : 0;
  const skipAmenities = step === 4 && !amenitiesTouched(amenities, hasToiletPhotos);

  // Объект считается добавленным только после ответа сервера: карточка уходит
  // на проверку, и лишь тогда появляется строка в «Сегодня».
  const save = async () => {
    if (!light || !point || !facts.category || photos.length === 0 || sending) return;
    setSending(true);
    setSendError(null);
    let input: SubmitMapperPlaceInput | null = null;
    try {
      const photo = await prepareFacadePhoto(photos[0].file);
      // Фото туалета не обязательны: не подготовилось — карточка идёт без него.
      const toiletBlobs: Blob[] = [];
      if (amenities.toilet === 'yes') {
        for (const p of toiletPhotos.slice(0, MAX_TOILET_PHOTOS)) {
          try {
            toiletBlobs.push(await prepareFacadePhoto(p.file));
          } catch {
            break;
          }
        }
      }
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
        stepHigh: stepHighOf(facts.stepHeightCm),
        doorWide: doorWideOf(facts.doorWidthCm),
        stepHeightCm: facts.stepHeightCm,
        doorWidthCm: facts.doorWidthCm,
        stepHeightSource: facts.stepHeightCm == null ? null : aiFields.has('stepHeightCm') ? 'photo' : 'person',
        doorWidthSource: facts.doorWidthCm == null ? null : aiFields.has('doorWidthCm') ? 'photo' : 'person',
        toilet: amenities.toilet,
        toiletAccessible: amenities.toilet === 'yes' ? amenities.toiletAccessible : 'unknown',
        toiletPhotos: toiletBlobs,
        toiletNote: amenities.toilet === 'yes' ? amenities.toiletNote.trim() || null : null,
        handWash: amenities.handWash,
        accessibleParking: amenities.accessibleParking,
        elevator: amenities.elevator,
      };
      // Без сети запрос провисел бы до таймаута: сразу идём в отложенные.
      if (ownerId && isOffline()) throw new SubmitPlaceError('unknown', 'Device is offline');
      const result = await submit(input);
      const wanted = amenities.toilet === 'yes' ? toiletPhotos.length : 0;
      setToiletLost(wanted > 0 && (result?.toiletPhotosSaved ?? wanted) < wanted);
      const fullCard = facts.steps != null && facts.doorWidthCm != null && facts.ramp != null;
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
            {STEPS.map((i) => (
              <i key={i} className={i <= step ? 'on' : ''} />
            ))}
          </div>
          <p>
            <b>Шаг {step} из {LAST_STEP}</b> · {STEP_NAME[step]}
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

      <input ref={toiletRef} type="file" accept="image/*" multiple hidden onChange={(e) => {
        const input = e.target;
        void addToiletPhotos(input.files).finally(() => {
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
            {(looking || aiFields.size > 0) && (
              <span className={`nf-pill${looking ? ' is-busy' : ''}`}>
                <Sparkles size={14} aria-hidden="true" />
                {looking ? 'ИИ смотрит фото…' : 'ИИ распознал по фото'}
              </span>
            )}
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

          <span className="nf-label">
            Замеры <em className="nf-tag">предварительно</em>
          </span>
          <div className="nf-row2">
            {(facts.steps ?? 0) > 0 && (
              <div>
                <label className="nf-label is-sub" htmlFor="nf-step-cm">
                  Высота ступени, см <AiMark on={aiFields.has('stepHeightCm')} />
                </label>
                <input
                  id="nf-step-cm"
                  className="nf-input"
                  inputMode="numeric"
                  autoComplete="off"
                  value={stepText}
                  aria-invalid={stepText.trim() !== '' && facts.stepHeightCm == null}
                  onChange={(e) => {
                    setStepText(e.target.value);
                    set({ stepHeightCm: parseCm(e.target.value, STEP_HEIGHT_RANGE) });
                  }}
                />
              </div>
            )}
            <div>
              <label className="nf-label is-sub" htmlFor="nf-door-cm">
                Ширина двери, см <AiMark on={aiFields.has('doorWidthCm')} />
              </label>
              <input
                id="nf-door-cm"
                className="nf-input"
                inputMode="numeric"
                autoComplete="off"
                value={doorText}
                aria-invalid={doorText.trim() !== '' && facts.doorWidthCm == null}
                onChange={(e) => {
                  setDoorText(e.target.value);
                  set({ doorWidthCm: parseCm(e.target.value, DOOR_WIDTH_RANGE) });
                }}
              />
            </div>
          </div>

          {aiFields.size > 0 && <p className="nf-hint">Проверьте и поправьте — ИИ мог ошибиться</p>}
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
        <div className="nf-body">
          <span className="nf-label">Туалет</span>
          <Pick
            label="Туалет"
            value={amenities.toilet}
            none="unknown"
            options={[
              ['yes', 'Есть'],
              ['no', 'Нет'],
            ]}
            onChange={(v) => setAmenity({ toilet: v })}
          />
          {amenities.toilet === 'yes' && (
            <>
              <span className="nf-label">Доступен на коляске</span>
              <Pick<ToiletAccessible>
                label="Доступен на коляске"
                value={amenities.toiletAccessible}
                none="unknown"
                options={[
                  ['yes', 'Да'],
                  ['partial', 'Частично'],
                  ['no', 'Нет'],
                ]}
                onChange={(v) => setAmenity({ toiletAccessible: v })}
              />
              <span className="nf-label">Фото туалета</span>
              <div className="nf-thumbs">
                {toiletPhotos.map((p, i) => (
                  <span key={p.url} className="nf-thumb">
                    <img src={p.url} alt={`Фото туалета ${i + 1}`} />
                    <button type="button" aria-label={`Убрать фото туалета ${i + 1}`} onClick={() => removeToiletPhoto(p.url)}>
                      <X size={14} />
                    </button>
                  </span>
                ))}
                {toiletPhotos.length < MAX_TOILET_PHOTOS && (
                  <button type="button" aria-label="Добавить фото туалета" onClick={() => toiletRef.current?.click()}>
                    <Camera size={22} />
                  </button>
                )}
              </div>
              <label className="nf-label" htmlFor="nf-toilet-note">
                Описание <AiMark on={noteByAi} />
              </label>
              <textarea
                id="nf-toilet-note"
                className="nf-input nf-textarea"
                rows={3}
                maxLength={TOILET_NOTE_MAX}
                placeholder={describing ? 'Помощник описывает фото…' : ''}
                value={amenities.toiletNote}
                onChange={(e) => {
                  setNoteByAi(false);
                  setAmenity({ toiletNote: e.target.value });
                }}
              />
            </>
          )}

          <span className="nf-label">Можно помыть руки</span>
          <Pick
            label="Можно помыть руки"
            value={amenities.handWash}
            none="unknown"
            options={YES_NO}
            onChange={(v) => setAmenity({ handWash: v })}
          />
          <span className="nf-label">Парковка для людей с инвалидностью</span>
          <Pick
            label="Парковка для людей с инвалидностью"
            value={amenities.accessibleParking}
            none="unknown"
            options={YES_NO}
            onChange={(v) => setAmenity({ accessibleParking: v })}
          />
          <span className="nf-label">Лифт между этажами</span>
          <Pick
            label="Лифт между этажами"
            value={amenities.elevator}
            none="unknown"
            options={YES_NO}
            onChange={(v) => setAmenity({ elevator: v })}
          />
        </div>
      )}

      {step === 5 && (
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
          {toiletLost && <p className="nf-hint">Фото туалета не сохранились, карточка ушла без них.</p>}
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
          {step === LAST_STEP && sendError && (
            <p className="nf-send-error" role="alert">
              {sendError}
            </p>
          )}
          {step === LAST_STEP ? (
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
              {skipAmenities ? 'Пропустить' : 'Далее'}
            </button>
          )}
        </footer>
      )}
    </div>,
    document.body,
  );
}
