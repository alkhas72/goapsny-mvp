import type { RampType, ToiletAccessible, YesNoUnknown } from '../shared/index';

/** Russian step count: «Нет ступеней», «1 ступень», «3 ступени», «5 ступеней». */
export function stepsText(count: number): string {
  if (count === 0) return 'Нет ступеней';
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ступень`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ступени`;
  return `${count} ступеней`;
}

export type HighlightKind = 'steps' | 'ramp' | 'door' | 'toilet' | 'elevator' | 'parking';

export interface AccessHighlight {
  kind: HighlightKind;
  text: string;
  /** Portable ramps carry the ramp marker next to the text. */
  portableRamp?: boolean;
}

/** The entrance facts a highlight can be built from (a subset of PublicPlace). */
export interface HighlightSource {
  stepsCount: number | null;
  stepHeightCm: number | null;
  rampType: RampType;
  doorWidthCm: number | null;
  toiletExists: YesNoUnknown;
  toiletAccessible: ToiletAccessible;
  parking: YesNoUnknown;
  details: { elevator?: 'yes' | 'no' | 'unknown' };
}

const RAMP_TEXT: Record<Exclude<RampType, 'none'>, string> = {
  permanent: 'Стационарный пандус',
  portable_available: 'Приставной пандус',
  portable_on_request: 'Пандус по запросу',
};

/**
 * Up to `limit` headline facts for the top of the place card, entrance first.
 * Only recorded values count: a null measurement or an "unknown" answer gives
 * no highlight at all, so a missing fact never reads as a negative one.
 */
export function accessHighlights(place: HighlightSource, limit = 3): AccessHighlight[] {
  const items: AccessHighlight[] = [];

  if (place.stepsCount === 0) {
    items.push({ kind: 'steps', text: 'Без ступеней' });
  } else if (place.stepsCount !== null && place.stepsCount > 0) {
    const height = place.stepHeightCm !== null && place.stepHeightCm > 0 ? ` по ${place.stepHeightCm} см` : '';
    items.push({ kind: 'steps', text: `${stepsText(place.stepsCount)}${height}` });
  }

  if (place.rampType !== 'none') {
    items.push({
      kind: 'ramp',
      text: RAMP_TEXT[place.rampType],
      portableRamp: place.rampType === 'portable_available' || place.rampType === 'portable_on_request',
    });
  }

  if (place.doorWidthCm !== null) {
    items.push({ kind: 'door', text: `Дверь ${place.doorWidthCm} см` });
  }

  if (place.toiletExists === 'yes') {
    if (place.toiletAccessible === 'yes') items.push({ kind: 'toilet', text: 'Доступный туалет' });
    else if (place.toiletAccessible === 'partial') items.push({ kind: 'toilet', text: 'Туалет частично доступен' });
    else if (place.toiletAccessible === 'no') items.push({ kind: 'toilet', text: 'Туалет недоступен' });
  }

  if (place.details.elevator === 'yes') items.push({ kind: 'elevator', text: 'Есть лифт' });
  if (place.parking === 'yes') items.push({ kind: 'parking', text: 'Есть парковка' });

  return items.slice(0, limit);
}
