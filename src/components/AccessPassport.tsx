import type { ReactNode } from 'react';
import type { PublicPlace } from '../services/places';
import { hasPortableRamp, rampLabel } from '../services/places';
import { RAMP_COLOR } from '../utils/status';
import { stepsText } from '../utils/accessText';

const UNKNOWN = 'неизвестно';

const YES_NO: Record<string, string> = { yes: 'есть', no: 'нет' };
const ACCESSIBLE: Record<string, string> = { yes: 'да', partial: 'частично', no: 'нет' };

function cm(value: number | null): string | null {
  return value === null ? null : `${value} см`;
}

/**
 * ramp_type defaults to 'none' in the schema, so 'none' alone does not prove the
 * entrance was checked. It counts as "no ramp" only when steps were recorded too.
 */
function rampValue(place: PublicPlace): ReactNode | null {
  if (place.rampType !== 'none') {
    return (
      <span className="passport-ramp">
        {hasPortableRamp(place.rampType) && (
          <span className="sheet-ramp-dot" style={{ backgroundColor: RAMP_COLOR }} aria-hidden="true" />
        )}
        {rampLabel(place.rampType)}
      </span>
    );
  }
  return place.stepsCount === null ? null : 'нет';
}

interface Row {
  label: string;
  value: ReactNode | null;
}

function passportGroups(place: PublicPlace): { title: string; rows: Row[] }[] {
  const noSteps = place.stepsCount === 0;
  const entrance: Row[] = [
    { label: 'Ступени', value: place.stepsCount === null ? null : stepsText(place.stepsCount) },
    ...(noSteps ? [] : [{ label: 'Высота ступени', value: cm(place.stepHeightCm) }]),
    { label: 'Ширина двери', value: cm(place.doorWidthCm) },
    // With no steps and no ramp recorded, a "no ramp" row would only alarm.
    ...(noSteps && place.rampType === 'none' ? [] : [{ label: 'Пандус', value: rampValue(place) }]),
    { label: 'Лифт', value: place.details.elevator ? YES_NO[place.details.elevator] ?? null : null },
  ];
  if (place.entranceNotes?.trim()) entrance.push({ label: 'Заметка о входе', value: place.entranceNotes.trim() });

  const toilet: Row[] = [{ label: 'Туалет', value: YES_NO[place.toiletExists] ?? null }];
  if (place.toiletExists !== 'no') {
    toilet.push({ label: 'Доступен для коляски', value: ACCESSIBLE[place.toiletAccessible] ?? null });
  }

  return [
    { title: 'Вход', rows: entrance },
    { title: 'Туалет', rows: toilet },
    { title: 'Парковка', rows: [{ label: 'Парковка', value: YES_NO[place.parking] ?? null }] },
  ];
}

export function AccessPassport({ place }: { place: PublicPlace }) {
  return (
    <section className="access-passport" aria-labelledby={`passport-${place.id}`}>
      <h4 id={`passport-${place.id}`} className="access-passport-title">Доступность</h4>
      {passportGroups(place).map((group) => (
        <div key={group.title} className="access-passport-group">
          <h5 className="access-passport-group-title">{group.title}</h5>
          <dl className="access-passport-rows">
            {group.rows.map((row) => (
              <div key={row.label} className="access-passport-row">
                <dt>{row.label}</dt>
                <dd>{row.value ?? <span className="access-passport-unknown">{UNKNOWN}</span>}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
