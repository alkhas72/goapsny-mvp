import { Layers, Moon, Sun, Sunrise, Sunset, X, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  BASEMAP_PALETTES,
  LIGHT_PRESETS,
  palettePreviewColors,
  type BasemapPalette,
  type LightPreset,
} from './goapsnyBasemap';
import { useDismiss } from './useDismiss';

const PALETTE_LABEL: Record<BasemapPalette, string> = {
  gray: 'Серая',
  blue: 'Синяя',
  violet: 'Сиреневая',
};

const PRESET_META: Record<LightPreset, { label: string; Icon: LucideIcon }> = {
  dawn: { label: 'Рассвет', Icon: Sunrise },
  day: { label: 'День', Icon: Sun },
  dusk: { label: 'Закат', Icon: Sunset },
  night: { label: 'Ночь', Icon: Moon },
};

interface MapViewControlsProps {
  palette: BasemapPalette;
  preset: LightPreset;
  threeD: boolean;
  onPalette: (palette: BasemapPalette) => void;
  onPreset: (preset: LightPreset) => void;
  onThreeD: (threeD: boolean) => void;
}

/** A small map in the palette's own colours under the current light. */
function PalettePreview({ palette, preset }: { palette: BasemapPalette; preset: LightPreset }) {
  const c = palettePreviewColors(palette, preset);
  return (
    <svg className="map-look-preview" viewBox="0 0 72 48" aria-hidden="true" focusable="false">
      <rect width="72" height="48" fill={c.land} />
      <path d="M0 34 C14 30 22 40 36 37 C50 34 58 42 72 38 V48 H0 Z" fill={c.water} />
      <path d="M0 6 L30 9 M40 26 L72 29 M8 -2 L4 34" stroke={c.road} strokeWidth="1.6" fill="none" />
      <path d="M-2 14 L74 22 M24 -2 L19 36 M50 -2 L54 33" stroke={c.roadMajor} strokeWidth="3.2" fill="none" />
    </svg>
  );
}

/**
 * Map look behind one "Вид карты" button: base colour, light, 3D. The panel
 * closes on Escape, on a tap outside or on its close button; focus returns
 * to the button.
 */
export function MapViewControls({
  palette,
  preset,
  threeD,
  onPalette,
  onPreset,
  onThreeD,
}: MapViewControlsProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const titleId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, panelRef, triggerRef);

  // Opening moves focus to the current colour, so keyboard users land
  // inside the panel on what they are most likely to change.
  useEffect(() => {
    if (!open) return;
    const current = panelRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <div className="map-look">
      <button
        ref={triggerRef}
        type="button"
        className={`map-chrome-btn map-look-trigger${open ? ' is-open' : ''}`}
        aria-label="Вид карты"
        title="Вид карты"
        aria-expanded={open}
        aria-controls={panelId}
        data-touch-target="44"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <Layers size={22} strokeWidth={2} aria-hidden="true" />
      </button>

      <div
        ref={panelRef}
        id={panelId}
        className="map-look-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        hidden={!open}
      >
        <div className="map-look-head">
          <h2 id={titleId} className="map-look-title">
            Вид карты
          </h2>
          <button
            type="button"
            className="map-look-close"
            aria-label="Закрыть"
            data-touch-target="44"
            onClick={() => {
              close();
              triggerRef.current?.focus({ preventScroll: true });
            }}
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="map-look-section" role="group" aria-labelledby={`${titleId}-palette`}>
          <p id={`${titleId}-palette`} className="map-look-label">
            Цвет карты
          </p>
          <div className="map-look-palettes">
            {BASEMAP_PALETTES.map((p) => (
              <button
                key={p}
                type="button"
                className={`map-look-tile${p === palette ? ' is-active' : ''}`}
                aria-pressed={p === palette}
                onClick={() => onPalette(p)}
              >
                <PalettePreview palette={p} preset={preset} />
                <span className="map-look-tile-text">{PALETTE_LABEL[p]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="map-look-section" role="group" aria-labelledby={`${titleId}-light`}>
          <p id={`${titleId}-light`} className="map-look-label">
            Освещение
          </p>
          <div className="map-look-segments">
            {LIGHT_PRESETS.map((p) => {
              const { label, Icon } = PRESET_META[p];
              return (
                <button
                  key={p}
                  type="button"
                  className={`map-look-segment${p === preset ? ' is-active' : ''}`}
                  aria-pressed={p === preset}
                  onClick={() => onPreset(p)}
                >
                  <Icon size={20} strokeWidth={2} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="map-look-section map-look-switch-row">
          <span className="map-look-switch-text">
            <span className="map-look-label" id={`${titleId}-3d`}>
              3D
            </span>
            <span className="map-look-hint" id={`${titleId}-3d-hint`}>
              Наклон и объёмные дома
            </span>
          </span>
          <button
            type="button"
            role="switch"
            className={`map-look-switch${threeD ? ' is-on' : ''}`}
            aria-checked={threeD}
            aria-labelledby={`${titleId}-3d`}
            aria-describedby={`${titleId}-3d-hint`}
            onClick={() => onThreeD(!threeD)}
          >
            <span className="map-look-switch-thumb" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
