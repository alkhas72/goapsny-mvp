import type { ReactNode } from 'react';
import { DoorOpen, SquareParking, Toilet, type LucideIcon } from 'lucide-react';
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
          <span className="ps-ramp-dot" style={{ backgroundColor: RAMP_COLOR }} aria-hidden="true" />
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
  /** Free text reads better under its label than squeezed to the right. */
  stacked?: boolean;
}

interface Group {
  key: string;
  title: string;
  icon: LucideIcon;
  /** A single-answer group (toilet, parking) shows its answer next to the title. */
  value?: ReactNode | null;
  rows: Row[];
}

function passportGroups(place: PublicPlace): Group[] {
  const noSteps = place.stepsCount === 0;
  const entrance: Row[] = [
    { label: 'Ступени', value: place.stepsCount === null ? null : stepsText(place.stepsCount) },
    ...(noSteps ? [] : [{ label: 'Высота ступени', value: cm(place.stepHeightCm) }]),
    { label: 'Ширина двери', value: cm(place.doorWidthCm) },
    // With no steps and no ramp recorded, a "no ramp" row would only alarm.
    ...(noSteps && place.rampType === 'none' ? [] : [{ label: 'Пандус', value: rampValue(place) }]),
    { label: 'Лифт', value: place.details.elevator ? YES_NO[place.details.elevator] ?? null : null },
  ];
  if (place.entranceNotes?.trim()) {
    entrance.push({ label: 'Заметка о входе', value: place.entranceNotes.trim(), stacked: true });
  }

  const toiletRows: Row[] =
    place.toiletExists === 'no'
      ? []
      : [{ label: 'Доступен для коляски', value: ACCESSIBLE[place.toiletAccessible] ?? null }];

  return [
    { key: 'entrance', title: 'Вход', icon: DoorOpen, rows: entrance },
    { key: 'toilet', title: 'Туалет', icon: Toilet, value: YES_NO[place.toiletExists] ?? null, rows: toiletRows },
    { key: 'parking', title: 'Парковка', icon: SquareParking, value: YES_NO[place.parking] ?? null, rows: [] },
  ];
}

function Value({ value }: { value: ReactNode | null }) {
  return value === null ? <span className="access-passport-unknown">{UNKNOWN}</span> : <>{value}</>;
}

export function AccessPassport({ place }: { place: PublicPlace }) {
  const headingId = `passport-${place.id}`;
  return (
    <section className="access-passport" aria-labelledby={headingId}>
      <h4 id={headingId} className="access-passport-title">Доступность</h4>
      {passportGroups(place).map((group) => {
        const Icon = group.icon;
        const titleId = `${headingId}-${group.key}`;
        // Nothing recorded in the whole group: one quiet line instead of a column of unknowns.
        const empty = (group.value ?? null) === null && group.rows.every((row) => row.value === null);
        const headValue = 'value' in group || empty;
        const rows = empty ? [] : group.rows;
        return (
          <div key={group.key} className="access-passport-group" role="group" aria-labelledby={titleId}>
            <div className="access-passport-group-head">
              <span className="access-passport-group-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <h5 id={titleId} className="access-passport-group-title">{group.title}</h5>
              {headValue && (
                <span className="access-passport-group-value" data-testid={`passport-${group.key}-value`}>
                  <Value value={group.value ?? null} />
                </span>
              )}
            </div>
            {rows.length > 0 && (
              <dl className="access-passport-rows">
                {rows.map((row) => (
                  <div
                    key={row.label}
                    className={row.stacked ? 'access-passport-row access-passport-row--stacked' : 'access-passport-row'}
                  >
                    <dt>{row.label}</dt>
                    <dd>
                      <Value value={row.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
    </section>
  );
}
