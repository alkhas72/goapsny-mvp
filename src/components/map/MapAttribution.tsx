import { Info } from 'lucide-react';
import { Fragment, useCallback, useId, useRef, useState } from 'react';
import { useDismiss } from './useDismiss';
import { MAP_ATTRIBUTION_ITEMS } from './vectorStyle';

/**
 * Map credits behind a small "i", collapsed by default on every width, the
 * way large map apps show them. Opens on tap, closes on Escape or a tap
 * outside.
 */
export function MapAttribution() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, panelRef, triggerRef);

  return (
    <div className="map-attrib">
      <button
        ref={triggerRef}
        type="button"
        className="map-attrib-trigger"
        aria-label="Авторы карты"
        title="Авторы карты"
        aria-expanded={open}
        aria-controls={panelId}
        data-touch-target="44"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <span className="map-attrib-dot" aria-hidden="true">
          <Info size={16} strokeWidth={2.25} />
        </span>
      </button>
      <div
        ref={panelRef}
        id={panelId}
        className="map-attrib-panel"
        role="region"
        aria-label="Авторы карты"
        hidden={!open}
      >
        {MAP_ATTRIBUTION_ITEMS.map((item, index) => (
          <Fragment key={item.label}>
            {index > 0 && ' '}
            <span className="map-attrib-item">
              {item.href ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.label}
                </a>
              ) : (
                item.label
              )}
              {index < MAP_ATTRIBUTION_ITEMS.length - 1 && <span aria-hidden="true">{'\u00A0·'}</span>}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
