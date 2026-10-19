import { useEffect, useRef } from 'react';
import { STATUS_META } from '../shared/index';
import type { AccessibilityStatus } from '../shared/index';
import { RAMP_COLOR } from '../utils/status';
import { trapFocus } from '../utils/focusTrap';
import { AccessibleIconLogo } from './MapHeader';
import { STATUS_WORD } from './PlaceListModel';
import './discovery.css';

const STATUS_ROWS: AccessibilityStatus[] = ['green', 'yellow', 'red', 'gray'];

const PIN_PATH = 'M14 36C14 36 27 24 27 14C27 6.8 21.2 1 14 1C6.8 1 1 6.8 1 14C1 24 14 36 14 36Z';

/** The same pin the map draws, so the legend teaches the real marker. */
function LegendPin({ fill, center }: { fill: string; center?: string }) {
  return (
    <svg className="dv-legend-pin" width="22" height="28" viewBox="0 0 28 36" aria-hidden="true">
      <path d={PIN_PATH} fill={fill} stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="14" cy="14" r="5.5" fill={center ?? '#FFFFFF'} stroke={center ? '#FFFFFF' : 'none'} strokeWidth="2" />
    </svg>
  );
}

interface WelcomeLegendProps {
  onContinue: () => void;
}

export function WelcomeLegend({ onContinue }: WelcomeLegendProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onContinueRef = useRef(onContinue);
  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);

  useEffect(() => {
    if (!dialogRef.current) return;
    return trapFocus(dialogRef.current, {
      initialFocus: dialogRef.current,
      onEscape: () => onContinueRef.current(),
    });
  }, []);

  return (
    <div className="dv-welcome-scrim">
      <div
        ref={dialogRef}
        className="dv-welcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        tabIndex={-1}
      >
        <div className="dv-welcome-head">
          <span className="dv-welcome-mark">
            <AccessibleIconLogo />
          </span>
          <h1 id="welcome-title" className="dv-welcome-title">
            Добро пожаловать в GoApsny
          </h1>
          <p className="dv-welcome-sub">Карта доступности Абхазии</p>
        </div>
        <ul className="dv-legend" aria-label="Обозначения на карте">
          {STATUS_ROWS.map((status) => (
            <li key={status} className="dv-legend-row">
              <LegendPin fill={STATUS_META[status].color} />
              <span>{STATUS_WORD[status]}</span>
            </li>
          ))}
          <li className="dv-legend-row">
            <span className="dv-legend-ramp" aria-hidden="true">
              <span style={{ backgroundColor: RAMP_COLOR }} />
            </span>
            <span>Приставной пандус</span>
          </li>
        </ul>
        <button type="button" className="dv-btn dv-btn--primary dv-welcome-ok" onClick={onContinue}>
          ОК, поехали!
        </button>
      </div>
    </div>
  );
}
