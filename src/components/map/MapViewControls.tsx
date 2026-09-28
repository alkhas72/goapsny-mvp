import { Moon, Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react';
import {
  BASEMAP_PALETTES,
  LIGHT_PRESETS,
  PALETTE_SWATCH,
  type BasemapPalette,
  type LightPreset,
} from './goapsnyBasemap';

const PALETTE_LABEL: Record<BasemapPalette, string> = {
  gray: 'Серая карта',
  blue: 'Синяя карта',
  violet: 'Сиреневая карта',
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

/**
 * Map look: base palette → light → 2D/3D, after the Mapbox Standard panel.
 * The palette is the user's base; light and view change the same map.
 */
export function MapViewControls({
  palette,
  preset,
  threeD,
  onPalette,
  onPreset,
  onThreeD,
}: MapViewControlsProps) {
  return (
    <div className="map-view-controls" role="toolbar" aria-label="Вид карты">
      <div className="map-view-group" role="group" aria-label="Цвет карты">
        {BASEMAP_PALETTES.map((p) => (
          <button
            key={p}
            type="button"
            className={`map-view-btn map-view-swatch${p === palette ? ' is-active' : ''}`}
            aria-label={PALETTE_LABEL[p]}
            title={PALETTE_LABEL[p]}
            aria-pressed={p === palette}
            data-touch-target="44"
            onClick={() => onPalette(p)}
          >
            <span style={{ backgroundColor: PALETTE_SWATCH[p] }} />
          </button>
        ))}
      </div>

      <div className="map-view-group" role="group" aria-label="Объём">
        <button
          type="button"
          className={`map-view-btn map-view-3d${threeD ? ' is-active' : ''}`}
          aria-label={threeD ? 'Плоская карта' : 'Объёмная карта'}
          title={threeD ? 'Плоская карта' : 'Объёмная карта'}
          aria-pressed={threeD}
          data-touch-target="44"
          onClick={() => onThreeD(!threeD)}
        >
          {threeD ? '2D' : '3D'}
        </button>
      </div>

      <div className="map-view-group" role="group" aria-label="Освещение">
        {LIGHT_PRESETS.map((p) => {
          const { label, Icon } = PRESET_META[p];
          return (
            <button
              key={p}
              type="button"
              className={`map-view-btn${p === preset ? ' is-active' : ''}`}
              aria-label={label}
              title={label}
              aria-pressed={p === preset}
              data-touch-target="44"
              onClick={() => onPreset(p)}
            >
              <Icon size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
