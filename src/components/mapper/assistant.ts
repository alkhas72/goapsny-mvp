/**
 * Mapper assistant — the logic behind the add flow.
 *
 * The assistant is impersonal in public products for now (Arbitrator 28.09).
 * It looks at the entrance photo, fills in what it can see; the mapper checks
 * and measures the rest. The traffic light is suggested with a reason, after the AIS
 * methodology (Wheelmap-compatible, stricter): green — step-free entrance;
 * yellow — one low step (≤ 7 cm) or a portable ramp; red — steps without a
 * ramp, a high step or a door narrower than 80 cm.
 */
import type { AccessibilityStatus, RampType } from '../../shared/index';

export type YesNoUnknown = 'yes' | 'no' | 'unknown';

/** What the assistant read from the entrance photo. Null — not visible. */
export interface EntranceDraft {
  name: string | null;
  category: string | null;
  subtype: string | null;
  stepsVisible: number | null;
  ramp: RampType | null;
}

/** Facts the mapper confirmed; the place card is built from these. */
export interface EntranceFacts {
  category: string | null;
  subtype: string | null;
  name: string;
  steps: number | null;
  stepHigh: YesNoUnknown;
  ramp: RampType | null;
  doorWide: YesNoUnknown;
}

export const EMPTY_FACTS: EntranceFacts = {
  category: null,
  subtype: null,
  name: '',
  steps: null,
  stepHigh: 'unknown',
  ramp: null,
  doorWide: 'unknown',
};

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
  if (facts.doorWide === 'unknown') unchecked.push('ширина двери');

  const steps = facts.steps ?? 0;
  const permanentRamp = facts.ramp === 'permanent';
  const portableRamp = facts.ramp === 'portable_available' || facts.ramp === 'portable_on_request';

  if (facts.doorWide === 'no') {
    return { status: 'red', reason: 'дверь уже 80 см — коляска не проходит', unchecked };
  }
  if (steps === 0 || permanentRamp) {
    const reason = steps === 0 ? 'вход без ступеней' : 'есть постоянный пандус';
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
  if (steps === 1 && facts.stepHigh === 'no') {
    return { status: 'yellow', reason: 'одна низкая ступень, до 7 см', unchecked };
  }
  if (steps === 1 && facts.stepHigh === 'unknown') unchecked.push('высота ступени');
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
  };
}

/** Object types inside a category — the mapper picks from these, not types. */
export const SUBTYPES: Record<string, string[]> = {
  health: ['Аптека', 'Поликлиника', 'Больница', 'Стоматология', 'Лаборатория'],
  food: ['Кафе', 'Ресторан', 'Столовая', 'Кофейня', 'Пекарня'],
  shops: ['Продукты', 'Супермаркет', 'Одежда', 'Хозяйственный', 'Рынок'],
  government: ['Администрация', 'МФЦ', 'Суд', 'Паспортный стол', 'Пенсионный фонд'],
  bank_post: ['Банк', 'Банкомат', 'Почта'],
  education: ['Школа', 'Детский сад', 'Университет', 'Колледж', 'Библиотека'],
  leisure: ['Театр', 'Музей', 'Кинотеатр', 'Дом культуры', 'Парк'],
  tourism: ['Памятник', 'Набережная', 'Смотровая площадка', 'Храм'],
  accommodation: ['Гостиница', 'Гостевой дом', 'Хостел'],
  public_transport: ['Остановка', 'Автовокзал', 'Вокзал'],
  sport: ['Стадион', 'Спортзал', 'Бассейн'],
  toilets: ['Общественный туалет'],
};
