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
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { fetchLiveToken, guideAssistant, GuidePatch } from '../../services/assistantApi';
import type { LiveMeasure, startLive } from '../../services/geminiLive';
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
import { Companion } from './Companion';
import { appendDay, type DayEntry } from './dayLog';
import { cloudEyes, type AssistantEyes } from './eyes';
import { LivePanel, type LivePanelHandle } from './LivePanel';
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
  /**
   * Координатору, администратору и владельцу в этих же шагах доступен
   * разговор с помощником через камеру и голос.
   */
  canLive?: boolean;
  /** Швы помощника; подменяются в тестах. */
  guide?: typeof guideAssistant;
  liveToken?: typeof fetchLiveToken;
  liveStart?: typeof startLive;
  /** Отложенная отправка; подменяется в тестах. */
  outbox?: Pick<MapperOutbox, 'add'>;
  onClose: () => void;
  onSaved: (entries: DayEntry[]) => void;
  onOpenDay: () => void;
  onAnother: () => void;
}

/** Помощник волонтёров: один на всё приложение. */
const DEFAULT_EYES = cloudEyes();

const MAX_PHOTOS = 5;

const RAMP_LABEL: Record<RampType, string> = {
  none: 'Нет',
  permanent: 'Постоянный',
  portable_available: 'Приставной, на месте',
  portable_on_request: 'Приставной, по просьбе',
  lift: 'Подъёмник',
};

const STATUS_CARD = {
  green: { title: 'Доступно', short: 'Доступно', text: 'вход без барьеров' },
  yellow: { title: 'Частично', short: 'Частично', text: 'въезд есть, но с ограничениями' },
  red: { title: 'Недоступно', short: 'Нет', text: 'входная группа недоступна' },
} as const;

type Light = keyof typeof STATUS_CARD;

function AiMark({ on, short = false }: { on: boolean; short?: boolean }) {
  if (!on) return null;
  // В узкой подписи замера слово не помещается: остаётся значок.
  if (short) return <Sparkles className="ai-mark" size={14} aria-label="по фото" />;
  return <em className="nf-tag is-ai">по фото</em>;
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

/** Скрытое поле выбора снимка: камера, галерея или фото туалета. */
function PhotoInput({
  ref,
  take,
  capture,
  multiple,
}: {
  ref: RefObject<HTMLInputElement | null>;
  take: (files: FileList | null) => Promise<void>;
  capture?: 'environment';
  multiple?: boolean;
}) {
  return (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      hidden
      capture={capture}
      multiple={multiple}
      onChange={(e) => {
        const input = e.target;
        // Поле очищаем после чтения: до него файл должен оставаться живым.
        void take(input.files).finally(() => {
          input.value = '';
        });
      }}
    />
  );
}

/**
 * «Новый объект»: один экран вместо пяти окон (решение 27.11). Снимок входа
 * закреплён сверху, под ним поля, которые помощник заполнил по снимку, строка
 * помощника и одна кнопка отправки. Программа минимум: одно фото входа.
 * Неудачный кадр или пустое название отправку не блокируют: подсказка идёт
 * строкой, цвет метки предлагается по данным входа, пока человек не выбрал сам.
 * «Туалет и удобства» свёрнуты и раскрываются по желанию.
 */
export function MapperFlow({
  theme,
  getCenter,
  eyes = DEFAULT_EYES,
  submit = submitMapperPlace,
  ownerId = null,
  canLive = false,
  guide,
  liveToken,
  liveStart,
  outbox,
  onClose,
  onSaved,
  onOpenDay,
  onAnother,
}: MapperFlowProps) {
  // Помощник закончил смотреть снимок: дальше можно сказать, что кадр не удался.
  const [lookDone, setLookDone] = useState(false);
  const [comfortOpen, setComfortOpen] = useState(false);
  // Отправку остановило только отсутствие категории: подсказка у поля.
  const [needCategory, setNeedCategory] = useState(false);
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [looking, setLooking] = useState(false);
  const [aiFields, setAiFields] = useState<Set<keyof EntranceFacts>>(() => new Set());
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
  // Последний текст описания: ответ помощника не должен затереть слова человека.
  const noteRef = useRef('');
  const liveRef = useRef<LivePanelHandle | null>(null);
  // Что человек назвал помощнику словами или в разговоре с камерой: это
  // важнее того, что помощник прочтёт по фото входа.
  const toldRef = useRef<Partial<EntranceFacts>>({});
  // Поля, которые помощник увидел в разговоре с камерой: отметка остаётся.
  const liveSeenRef = useRef<Set<keyof EntranceFacts>>(new Set());
  useEffect(() => {
    noteRef.current = amenities.toiletNote;
  }, [amenities.toiletNote]);

  const suggestion = useMemo(() => suggestStatus(facts), [facts]);
  // Цвет метки идёт за данными входа, пока человек не выбрал сам.
  const chosen: Light | null = photos.length > 0 ? (light ?? suggestion.status) : light;
  const done = saved != null || kept != null;
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
    (Object.keys(patch) as (keyof EntranceFacts)[]).forEach((k) => liveSeenRef.current.delete(k));
    // Человек поправил названное помощнику: дальше держим его правку.
    const told = toldRef.current;
    const kept = Object.fromEntries(Object.entries(patch).filter(([k]) => k in told));
    if (Object.keys(kept).length > 0) toldRef.current = { ...told, ...kept };
  };

  /** Поля входа, названные помощнику. `seen`: помощник увидел их сам, через камеру. */
  const tell = (patch: Partial<EntranceFacts>, seen: boolean) => {
    if (Object.keys(patch).length === 0) return;
    toldRef.current = { ...toldRef.current, ...patch };
    set(patch);
    if (patch.stepHeightCm != null) setStepText(String(patch.stepHeightCm));
    if (patch.doorWidthCm != null) setDoorText(String(patch.doorWidthCm));
    if (!seen) return;
    const keys = Object.keys(patch) as (keyof EntranceFacts)[];
    keys.forEach((k) => liveSeenRef.current.add(k));
    setAiFields((prev) => new Set([...prev, ...keys]));
  };

  /** Помощник заполнил поля со слов человека. */
  const applyGuide = (patch: GuidePatch) => {
    const entrance: Partial<EntranceFacts> = {};
    if (patch.name) entrance.name = patch.name;
    if (patch.category && CATEGORIES.some((c) => c.slug === patch.category)) {
      entrance.category = patch.category;
      // Тип объекта принадлежит категории: со сменой категории он сбрасывается.
      if (patch.category !== facts.category) entrance.subtype = null;
    }
    const scope = entrance.category ?? facts.category;
    if (patch.subtype && scope && (SUBTYPES[scope] ?? []).includes(patch.subtype)) entrance.subtype = patch.subtype;
    if (patch.steps != null) entrance.steps = patch.steps;
    if (patch.step_height_cm != null) entrance.stepHeightCm = patch.step_height_cm;
    if (patch.door_width_cm != null) entrance.doorWidthCm = patch.door_width_cm;
    if (patch.ramp && patch.ramp in RAMP_LABEL) entrance.ramp = patch.ramp as RampType;
    tell(entrance, false);

    const comfort: Partial<Amenities> = {};
    if (patch.toilet) comfort.toilet = patch.toilet;
    if (patch.toilet_accessible) comfort.toiletAccessible = patch.toilet_accessible;
    if (patch.toilet_note) comfort.toiletNote = patch.toilet_note.slice(0, TOILET_NOTE_MAX);
    if (patch.hand_wash) comfort.handWash = patch.hand_wash;
    if (patch.accessible_parking) comfort.accessibleParking = patch.accessible_parking;
    if (patch.elevator) comfort.elevator = patch.elevator;
    // Про доступность или описание туалета говорят, когда туалет есть.
    if ((comfort.toiletAccessible || comfort.toiletNote) && !comfort.toilet) comfort.toilet = 'yes';
    if (Object.keys(comfort).length === 0) return;
    if (comfort.toiletNote) setNoteByAi(false);
    setAmenities((a) => ({ ...a, ...comfort }));
    // Записанное помощником должно быть видно: блок раскрывается.
    setComfortOpen(true);
  };

  /** Цифры, которые помощник записал в разговоре с камерой. */
  const applyLive = (measure: LiveMeasure) => {
    const entrance: Partial<EntranceFacts> = {};
    if (measure.steps != null) entrance.steps = measure.steps;
    if (measure.stepHeightCm != null) entrance.stepHeightCm = measure.stepHeightCm;
    if (measure.doorWidthCm != null) entrance.doorWidthCm = measure.doorWidthCm;
    tell(entrance, true);
  };

  /** Что сейчас в карточке: помощник видит это и не спрашивает заново. */
  const card = useMemo(() => {
    const shown: Record<string, string | number> = {};
    if (facts.name.trim()) shown.name = facts.name.trim();
    if (facts.category) shown.category = facts.category;
    if (facts.subtype) shown.subtype = facts.subtype;
    if (facts.steps != null) shown.steps = facts.steps;
    if (facts.stepHeightCm != null) shown.step_height_cm = facts.stepHeightCm;
    if (facts.doorWidthCm != null) shown.door_width_cm = facts.doorWidthCm;
    if (facts.ramp) shown.ramp = facts.ramp;
    if (chosen) shown.status = chosen;
    if (amenities.toilet !== 'unknown') shown.toilet = amenities.toilet;
    if (amenities.toiletAccessible !== 'unknown') shown.toilet_accessible = amenities.toiletAccessible;
    if (amenities.toiletNote.trim()) shown.toilet_note = amenities.toiletNote.trim();
    if (amenities.handWash !== 'unknown') shown.hand_wash = amenities.handWash;
    if (amenities.accessibleParking !== 'unknown') shown.accessible_parking = amenities.accessibleParking;
    if (amenities.elevator !== 'unknown') shown.elevator = amenities.elevator;
    return shown;
  }, [facts, chosen, amenities]);

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const first = photos.length === 0;
    const picked = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    // Снимок сразу читаем в память: к отправке временный файл камеры на iPhone
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
        // Названное помощнику словами или в разговоре важнее прочитанного по фото.
        const told = toldRef.current;
        const next = { ...factsFromDraft(draft), ...told };
        setFacts(next);
        setStepText(next.stepHeightCm != null ? String(next.stepHeightCm) : '');
        setDoorText(next.doorWidthCm != null ? String(next.doorWidthCm) : '');
        const seen = new Set<keyof EntranceFacts>(liveSeenRef.current);
        const mark = (key: keyof EntranceFacts, read: boolean) => {
          if (read && !(key in told)) seen.add(key);
        };
        mark('name', !!draft.name);
        mark('category', !!draft.category);
        mark('subtype', !!draft.subtype);
        mark('steps', draft.stepsVisible != null);
        mark('ramp', !!draft.ramp);
        mark('stepHeightCm', draft.stepHeightCm != null);
        mark('doorWidthCm', draft.doorWidthCm != null);
        setAiFields(seen);
      })
      .catch(() => undefined)
      .finally(() => {
        setLooking(false);
        setLookDone(true);
      });
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

  const hasToiletPhotos = amenities.toilet === 'yes' ? toiletPhotos.length : 0;
  const comfortFilled = amenitiesTouched(amenities, hasToiletPhotos);
  // Название не обязательно: без него карточка уходит под типом или категорией.
  const sendName = facts.name.trim() || facts.subtype || category?.ru || '';

  // Объект считается добавленным только после ответа сервера: карточка уходит
  // на проверку, и лишь тогда появляется строка в «Сегодня».
  const save = async () => {
    if (photos.length === 0 || sending || looking) return;
    if (!facts.category) {
      // Без категории сервер карточку не примет: просим выбрать, не ругаем.
      setNeedCategory(true);
      setPickCategory(true);
      return;
    }
    const status = chosen ?? suggestion.status;
    // Место ещё определяется: берём центр карты, пин человек поправит позже.
    const at = point ?? getCenter();
    if (!at) return;
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
        name: sendName,
        category: facts.category,
        lat: at.lat,
        lng: at.lng,
        photo,
        status,
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
          name: sendName || 'Без названия',
          subtype: facts.subtype,
          status,
          reason: status === suggestion.status ? suggestion.reason : 'светофор поставил картограф',
          // На сервер уходит одно фото входа — столько же и в счёте.
          photos: 1,
        },
        fullCard,
      );
      setSaved(entries);
      onSaved(entries);
    } catch (error) {
      // Связь, вход или сервер: карточка в порядке, держим её на устройстве.
      if (input && ownerId && canWait(error)) {
        const reason = outboxReason(error);
        try {
          await (outbox ?? getMapperOutbox()).add(ownerId, input, reason);
          setKept(reason);
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
                  setNeedCategory(false);
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

  const hasPhoto = photos.length > 0;
  // Кадр не удался: помощник ничего не прочёл. Это подсказка, не запрет.
  const badShot = lookDone && !looking && aiFields.size === 0;
  const comfortCount = [
    amenities.toilet,
    amenities.handWash,
    amenities.accessibleParking,
    amenities.elevator,
  ].filter((v) => v !== 'unknown').length;

  // Full screen over the whole app: the map has done its job.
  return createPortal(
    <div className="nf-screen is-one" role="dialog" aria-modal="true" aria-label="Новый объект">
      <header className="nf-top">
        <span>Новый объект</span>
        <button type="button" aria-label="Закрыть" onClick={onClose}>
          <X size={22} />
        </button>
      </header>

      <PhotoInput ref={cameraRef} take={addPhotos} capture="environment" />
      <PhotoInput ref={galleryRef} take={addPhotos} multiple />
      <PhotoInput ref={toiletRef} take={addToiletPhotos} multiple />

      {!done && !hasPhoto && (
        <div className="nf-body nf-photo-step">
          <button type="button" className="nf-drop" onClick={() => cameraRef.current?.click()}>
            <Camera size={48} strokeWidth={1.6} aria-hidden="true" />
            Сфотографируйте вход
            <small>Одного снимка достаточно. Остальное помощник заполнит сам.</small>
          </button>
          <div className="nf-two">
            <button type="button" className="nf-btn is-work" onClick={() => cameraRef.current?.click()}>
              <Camera size={18} aria-hidden="true" /> Камера
            </button>
            <button type="button" className="nf-btn is-ghost" onClick={() => galleryRef.current?.click()}>
              <ImageIcon size={18} aria-hidden="true" /> Галерея
            </button>
          </div>
        </div>
      )}

      {!done && hasPhoto && (
        <div className="nf-body nf-one">
          <div className="nf-pin">
            <div className="nf-pin-photo">
              <img src={photos[0].url} alt="Фото входа" />
              {photos.length > 1 && <span className="nf-pin-count">{photos.length} фото</span>}
              {photos.length < MAX_PHOTOS && (
                <button type="button" aria-label="Ещё фото" onClick={() => cameraRef.current?.click()}>
                  <Plus size={18} aria-hidden="true" /> фото
                </button>
              )}
            </div>
            <p className={`nf-note${looking ? ' is-busy' : ''}`} role="status">
              <Sparkles size={14} aria-hidden="true" />
              {looking
                ? 'Помощник смотрит снимок…'
                : badShot
                  ? 'По снимку вход не разобрать. Заполните сами или снимите ещё раз, отправить можно и так.'
                  : aiFields.size > 0
                    ? 'Заполнено по снимку. Проверьте и поправьте, что не так.'
                    : 'Проверьте поля и отправляйте.'}
            </p>
          </div>
          {photos.length > 1 && <p className="nf-hint">В карточку уйдёт первое фото. Остальные пока не сохраняются.</p>}

          <section className="nf-card" aria-label="Что это">
            <label className="nf-label" htmlFor="nf-name">
              Название <AiMark on={aiFields.has('name')} />
            </label>
            <input
              id="nf-name"
              className="nf-input"
              placeholder={facts.subtype || category?.ru || 'Как называется место'}
              value={facts.name}
              onChange={(e) => set({ name: e.target.value })}
            />

            <span className="nf-label">
              Категория <AiMark on={aiFields.has('category')} />
            </span>
            <button
              type="button"
              className="nf-input nf-select"
              aria-invalid={needCategory && !facts.category}
              onClick={() => setPickCategory(true)}
            >
              {category ? category.ru : 'Выбрать'} <ChevronDown size={18} aria-hidden="true" />
            </button>
            {needCategory && !facts.category && (
              <p className="nf-hint is-ask">Выберите, что это за место, и карточка уйдёт.</p>
            )}
            {facts.category && (
              <div className="nf-chips" role="group" aria-label="Тип объекта">
                {(SUBTYPES[facts.category] ?? []).map((t) => (
                  <button key={t} type="button" aria-pressed={t === facts.subtype} onClick={() => set({ subtype: t })}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="nf-card" aria-label="Вход">
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
                    Высота ступени, см <AiMark short on={aiFields.has('stepHeightCm')} />
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
                  Ширина двери, см <AiMark short on={aiFields.has('doorWidthCm')} />
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
          </section>

          <section className="nf-card" aria-label="Доступность">
            <span className="nf-label">
              Доступность {light == null && <em className="nf-tag is-ai">предложено</em>}
            </span>
            <div className="nf-lights" role="group" aria-label="Доступность">
              {(['green', 'yellow', 'red'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`nf-light is-${s}`}
                  aria-pressed={chosen === s}
                  aria-label={STATUS_CARD[s].title}
                  onClick={() => setLight(s)}
                >
                  <span className="nf-dot" aria-hidden="true" />
                  {STATUS_CARD[s].short}
                </button>
              ))}
            </div>
            {chosen && (
              <p className="nf-hint">
                {chosen === suggestion.status ? suggestion.reason : STATUS_CARD[chosen].text}
                {suggestion.unchecked.length > 0 && ` · не проверено: ${suggestion.unchecked.join(', ')}`}
              </p>
            )}
          </section>

          <section className={`nf-card nf-fold${comfortOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="nf-fold-head"
              aria-expanded={comfortOpen}
              aria-controls="nf-comfort"
              onClick={() => setComfortOpen((open) => !open)}
            >
              <span>Туалет и удобства</span>
              <small>{comfortFilled ? `отмечено: ${Math.max(comfortCount, 1)}` : 'по желанию'}</small>
              <ChevronDown size={18} aria-hidden="true" />
            </button>
            {comfortOpen && (
              <div id="nf-comfort" className="nf-fold-body">
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
          </section>

          <section className="nf-card" aria-label="Место на карте">
            <span className="nf-label">Место на карте</span>
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
            </div>
            <p className="nf-hint">Поставлено по вашему местоположению. Если пин не у входа, перетащите его.</p>
          </section>
        </div>
      )}

      {saved && (
        <div className="nf-body nf-done">
          <span className="nf-done-mark">
            <Check size={40} aria-hidden="true" />
          </span>
          <h2>{sendName || 'Объект'} — на проверке</h2>
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

      {!saved && kept && (
        <div className="nf-body nf-done is-kept">
          <span className="nf-done-mark">
            <CloudOff size={38} aria-hidden="true" />
          </span>
          <h2>{sendName || 'Объект'} — сохранён на устройстве</h2>
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

      {!done && (
        <Companion
          step={!hasPhoto ? 1 : comfortOpen ? 4 : 2}
          card={card}
          onPatch={applyGuide}
          canLive={canLive}
          onLive={() => liveRef.current?.begin()}
          guide={guide}
        />
      )}
      {canLive && <LivePanel ref={liveRef} onMeasure={applyLive} liveToken={liveToken} liveStart={liveStart} />}

      {!done && hasPhoto && (
        <footer className="nf-foot">
          {sendError && (
            <p className="nf-send-error" role="alert">
              {sendError}
            </p>
          )}
          <button
            type="button"
            className="nf-btn is-final"
            disabled={sending || looking}
            aria-busy={sending}
            onClick={() => void save()}
          >
            <Check size={18} aria-hidden="true" />
            {sending ? 'Отправляем…' : sendError ? 'Повторить отправку' : 'Всё верно, отправить'}
          </button>
        </footer>
      )}
    </div>,
    document.body,
  );
}
