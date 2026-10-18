// Словарь и микротексты опытной карточки места (лаборатория, ?lab=1).
// Владелец — Claude. Тексты короткие, читаются на слух, очевидное не объясняют.
import type { AccessibilityStatus, RampType, ToiletAccessible, YesNoUnknown } from '../shared';
import type { LabFact } from './contract';

export type RatedStatus = Exclude<AccessibilityStatus, 'gray'>;
export type FactField = LabFact['field'];

export const LAB_TEXT = {
  sheetLabel: 'Карточка места',
  close: 'Закрыть карточку',
  labNote: 'Опытный режим: всё сохраняется только на этом телефоне.',
  grayNote: 'Ещё не проверено волонтёром',

  rateQuestion: 'Насколько доступно?',
  rateHint: 'Ваша оценка не меняет цвет места. Его ставит волонтёр после проверки.',

  passportTitle: 'Паспорт доступности',
  groups: { entrance: 'Вход', toilet: 'Туалет', parking: 'Парковка' },
  unknown: 'неизвестно',
  add: 'Добавить',
  save: 'Сохранить',
  cancel: 'Отмена',

  reportOpen: 'Сообщить о проблеме',
  reportTitle: 'Что не так?',
  reportComment: 'Комментарий',
  reportSend: 'Сохранить',

  saved: 'Сохранено на телефоне',
  duplicate: 'Уже сохранено на телефоне',
  saveFailed: 'Не удалось сохранить',
} as const;

export const RATING_LABEL: Record<RatedStatus, string> = {
  green: 'Полностью',
  yellow: 'Частично',
  red: 'Нисколько',
};

export const RATING_ORDER: RatedStatus[] = ['green', 'yellow', 'red'];

export const FACT_LABEL: Record<FactField, string> = {
  steps_count: 'Ступени',
  step_height_cm: 'Высота ступени',
  door_width_cm: 'Ширина двери',
  ramp_type: 'Пандус',
  toilet_exists: 'Туалет есть',
  toilet_accessible: 'Туалет для коляски',
  parking: 'Парковка есть',
  parking_accessible: 'Парковка для коляски',
};

export const NUMBER_UNIT: Partial<Record<FactField, string>> = {
  step_height_cm: 'см',
  door_width_cm: 'см',
};

export const RAMP_OPTIONS: { value: RampType; label: string }[] = [
  { value: 'none', label: 'Нет' },
  { value: 'permanent', label: 'Стационарный' },
  { value: 'portable_available', label: 'Приставной' },
  { value: 'portable_on_request', label: 'По запросу' },
];

export const YES_NO_OPTIONS: { value: Exclude<YesNoUnknown, 'unknown'>; label: string }[] = [
  { value: 'yes', label: 'Да' },
  { value: 'no', label: 'Нет' },
];

export const ACCESSIBLE_OPTIONS: { value: Exclude<ToiletAccessible, 'unknown'>; label: string }[] = [
  { value: 'yes', label: 'Да' },
  { value: 'partial', label: 'Частично' },
  { value: 'no', label: 'Нет' },
];

export const PROBLEM_OPTIONS: { value: 'entrance' | 'information' | 'other'; label: string }[] = [
  { value: 'entrance', label: 'Вход изменился или недоступен' },
  { value: 'information', label: 'Неверные сведения' },
  { value: 'other', label: 'Другое' },
];

export function stepsText(count: number): string {
  if (count === 0) return 'Нет ступеней';
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ступень`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ступени`;
  return `${count} ступеней`;
}

export function optionLabel<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}
