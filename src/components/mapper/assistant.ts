/**
 * Mapper assistant — the logic behind the add flow.
 *
 * It looks at the entrance photo, fills in what it can see; the mapper checks
 * and measures the rest. The traffic light is suggested with a reason, after the AIS
 * methodology (Wheelmap-compatible, stricter): green — step-free entrance;
 * yellow — one low step (≤ 5 cm) or a portable ramp; red — steps without a
 * ramp, a high step or a door narrower than 80 cm.
 *
 * The 5 cm border is the Arbitrator's decision of 25.11: AIS builds portable
 * ramps starting from a 5 cm step, so the mark colour follows the same border
 * (Wheelmap and OSM draw it at 7 cm).
 *
 * 25.11 the Arbitrator replaced the «higher than 5 cm / wider than 80 cm»
 * questions with numbers: the step height and the door width go in as
 * centimetres. A measure has two states: preliminary (read from the photo or
 * typed by the volunteer) and final (the auditor's measure in the ramp layer).
 * Everything the mapper path sends is preliminary.
 */
import type { AccessibilityStatus, RampType, ToiletAccessible } from '../../shared/index';

export type YesNoUnknown = 'yes' | 'no' | 'unknown';

/** A step up to this height counts as low; AIS ramps start above it. */
export const STEP_BORDER_CM = 5;
/** A door at least this wide lets a wheelchair through. */
export const DOOR_BORDER_CM = 80;
/** What the server accepts (migration 20261125090000). */
export const STEP_HEIGHT_RANGE = [0, 100] as const;
export const DOOR_WIDTH_RANGE = [30, 500] as const;

/** Who gave the number: read from the photo, or typed by a person. */
export type MeasureSource = 'photo' | 'person';

/** What the assistant read from the entrance photo. Null — not visible. */
export interface EntranceDraft {
  name: string | null;
  category: string | null;
  subtype: string | null;
  stepsVisible: number | null;
  ramp: RampType | null;
  /** Rough centimetres read from the photo; the mapper corrects them. */
  stepHeightCm: number | null;
  doorWidthCm: number | null;
}

/** Facts the mapper confirmed; the place card is built from these. */
export interface EntranceFacts {
  category: string | null;
  subtype: string | null;
  name: string;
  steps: number | null;
  /** Height of the highest step, cm. Null — not measured. */
  stepHeightCm: number | null;
  ramp: RampType | null;
  /** Clear width of the door, cm. Null — not measured. */
  doorWidthCm: number | null;
}

export const EMPTY_FACTS: EntranceFacts = {
  category: null,
  subtype: null,
  name: '',
  steps: null,
  stepHeightCm: null,
  ramp: null,
  doorWidthCm: null,
};

/** «Is there a step higher than 5 cm» — derived from the number. */
export function stepHighOf(cm: number | null): YesNoUnknown {
  if (cm == null) return 'unknown';
  return cm > STEP_BORDER_CM ? 'yes' : 'no';
}

/** «Is the door wide enough» — derived from the number. */
export function doorWideOf(cm: number | null): YesNoUnknown {
  if (cm == null) return 'unknown';
  return cm >= DOOR_BORDER_CM ? 'yes' : 'no';
}

/** Typed centimetres → a whole number inside the range, or null. */
export function parseCm(text: string, range: readonly [number, number]): number | null {
  const cleaned = text.replace(',', '.').trim();
  if (!cleaned) return null;
  const n = Math.round(Number(cleaned));
  if (!Number.isFinite(n) || n < range[0] || n > range[1]) return null;
  return n;
}

/**
 * The toilet step and the three marks. Everything here is optional: an
 * untouched answer stays `unknown` and is not sent as a fact.
 */
export interface Amenities {
  toilet: YesNoUnknown;
  toiletAccessible: ToiletAccessible;
  toiletNote: string;
  /** A place to wash hands. */
  handWash: YesNoUnknown;
  /** Parking for people with disabilities; ordinary parking is not asked. */
  accessibleParking: YesNoUnknown;
  /** An elevator between floors; a platform lift at the entrance is a ramp type. */
  elevator: YesNoUnknown;
}

export const EMPTY_AMENITIES: Amenities = {
  toilet: 'unknown',
  toiletAccessible: 'unknown',
  toiletNote: '',
  handWash: 'unknown',
  accessibleParking: 'unknown',
  elevator: 'unknown',
};

export const MAX_TOILET_PHOTOS = 2;
export const TOILET_NOTE_MAX = 500;

export function amenitiesTouched(a: Amenities, photos: number): boolean {
  return (
    photos > 0 ||
    a.toilet !== 'unknown' ||
    a.handWash !== 'unknown' ||
    a.accessibleParking !== 'unknown' ||
    a.elevator !== 'unknown'
  );
}

export interface StatusSuggestion {
  status: Exclude<AccessibilityStatus, 'gray'>;
  reason: string;
  /** What is still unchecked; the card stays honest about it. */
  unchecked: string[];
}

function stepsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'ступень';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'ступени';
  return 'ступеней';
}

/** Traffic light with a plain-language reason (status_reason). */
export function suggestStatus(facts: EntranceFacts): StatusSuggestion {
  const unchecked: string[] = [];
  if (facts.steps == null) unchecked.push('ступени');
  if (facts.doorWidthCm == null) unchecked.push('ширина двери');

  const steps = facts.steps ?? 0;
  const permanentRamp = facts.ramp === 'permanent';
  const lift = facts.ramp === 'lift';
  const portableRamp = facts.ramp === 'portable_available' || facts.ramp === 'portable_on_request';

  if (facts.doorWidthCm != null && facts.doorWidthCm < DOOR_BORDER_CM) {
    return {
      status: 'red',
      reason: `дверь ${facts.doorWidthCm} см, уже ${DOOR_BORDER_CM} см — коляска не проходит`,
      unchecked,
    };
  }
  if (steps === 0 || permanentRamp || lift) {
    const reason = steps === 0 ? 'вход без ступеней' : lift ? 'есть подъёмник у входа' : 'есть постоянный пандус';
    return { status: 'green', reason, unchecked };
  }
  if (portableRamp) {
    const how = facts.ramp === 'portable_on_request' ? 'по просьбе' : 'на месте';
    return {
      status: 'yellow',
      reason: `${steps} ${stepsWord(steps)}, приставной пандус ${how}`,
      unchecked,
    };
  }
  if (steps === 1 && facts.stepHeightCm != null && facts.stepHeightCm <= STEP_BORDER_CM) {
    return { status: 'yellow', reason: `одна низкая ступень, ${facts.stepHeightCm} см`, unchecked };
  }
  if (facts.stepHeightCm == null) unchecked.push('высота ступени');
  return {
    status: 'red',
    reason: `${steps} ${stepsWord(steps)} без пандуса`,
    unchecked,
  };
}

/** Facts pre-filled from the assistant's look at the photo. */
export function factsFromDraft(draft: EntranceDraft): EntranceFacts {
  return {
    ...EMPTY_FACTS,
    category: draft.category,
    subtype: draft.subtype,
    name: draft.name ?? '',
    steps: draft.stepsVisible,
    ramp: draft.ramp,
    stepHeightCm: draft.stepHeightCm,
    doorWidthCm: draft.doorWidthCm,
  };
}

/**
 * Object types inside a category — the mapper picks from these, not types.
 *
 * 25.11 the Arbitrator compared the list with the category screen of an
 * OpenStreetMap app; what was missing there went in as types, the twelve
 * categories stay: parking, fuel and charging stations, car service and
 * pier under transport, emergency services under government and health.
 */
export const SUBTYPES: Record<string, string[]> = {
  health: ['Аптека', 'Поликлиника', 'Больница', 'Стоматология', 'Лаборатория', 'Скорая помощь'],
  food: ['Кафе', 'Ресторан', 'Столовая', 'Кофейня', 'Пекарня'],
  shops: ['Продукты', 'Супермаркет', 'Одежда', 'Хозяйственный', 'Рынок'],
  government: ['Администрация', 'МФЦ', 'Суд', 'Паспортный стол', 'Пенсионный фонд', 'Полиция', 'Пожарная часть'],
  bank_post: ['Банк', 'Банкомат', 'Почта'],
  education: ['Школа', 'Детский сад', 'Университет', 'Колледж', 'Библиотека'],
  leisure: ['Театр', 'Музей', 'Кинотеатр', 'Дом культуры', 'Парк'],
  tourism: ['Памятник', 'Набережная', 'Смотровая площадка', 'Храм'],
  accommodation: ['Гостиница', 'Гостевой дом', 'Хостел'],
  public_transport: ['Остановка', 'Автовокзал', 'Вокзал', 'Причал', 'Парковка', 'АЗС', 'Зарядная станция', 'Автосервис'],
  sport: ['Стадион', 'Спортзал', 'Бассейн'],
  toilets: ['Общественный туалет'],
};
