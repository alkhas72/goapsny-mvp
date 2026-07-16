import type { Place } from '../../types';
import { STATUS_META } from '../../shared/index';
import { RAMP_COLOR } from '../../utils/status';

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function renderMarkerPin(place: Place, isSelected: boolean): string {
  const statusColorValue = STATUS_META[place.status]?.color ?? '#A0A8B0';
  const hasPortableRamp = place.rampType === 'portable_available' || place.rampType === 'portable_on_request';
  const isPurpleCenter = hasPortableRamp && (place.status === 'green' || place.status === 'yellow');
  const centerFill = isPurpleCenter ? RAMP_COLOR : '#FFFFFF';
  const centerStroke = isPurpleCenter ? 'stroke="#FFFFFF" stroke-width="2.5"' : '';
  const label = escapeAttr(`${place.name}, ${STATUS_META[place.status]?.ru ?? place.status}`);

  return `
    <button type="button" class="map-pin-button ${isSelected ? 'is-selected' : ''}" data-place-id="${place.id}" aria-label="${label}">
      <span class="map-pin-wrapper ${isSelected ? 'is-selected' : ''}" aria-hidden="true">
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 36C14 36 27 24 27 14C27 6.8 21.2 1 14 1C6.8 1 1 6.8 1 14C1 24 14 36 14 36Z" fill="${statusColorValue}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
          <circle cx="14" cy="14" r="5.5" fill="${centerFill}" ${centerStroke}/>
        </svg>
      </span>
    </button>
  `;
}

export interface MarkerButtonHandlers {
  onSelectPlace?: (placeId: string) => void;
  onMarkerButton?: (placeId: string, button: HTMLButtonElement | null) => void;
}

export function wireMarkerButton(
  button: HTMLButtonElement,
  placeId: string,
  handlers: MarkerButtonHandlers,
): () => void {
  const activate = (event: Event) => {
    event.stopPropagation();
    handlers.onSelectPlace?.(placeId);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      handlers.onSelectPlace?.(placeId);
    }
  };

  button.addEventListener('click', activate);
  button.addEventListener('keydown', onKeyDown);
  handlers.onMarkerButton?.(placeId, button);

  return () => {
    button.removeEventListener('click', activate);
    button.removeEventListener('keydown', onKeyDown);
    handlers.onMarkerButton?.(placeId, null);
  };
}
