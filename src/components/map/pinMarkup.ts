import type { AccessibilityStatus } from '../../shared/index';
import { RAMP_COLOR, statusColor, statusLabel } from '../../utils/status';

/**
 * Place pin: status colour plus a status glyph (tick, exclamation, cross,
 * question mark), so the status reads without colour too. A portable ramp
 * fills the centre with the ramp colour. The button carries the status in
 * words in its aria-label: "Name, Status".
 */
export interface PinMarkupInput {
  placeName: string;
  status: string;
  rampType: string;
  isSelected: boolean;
  placeId: string;
}

type PinStatus = AccessibilityStatus;

const KNOWN: readonly PinStatus[] = ['green', 'yellow', 'red', 'gray'];

/** Darker ink of each status for the glyph on the white centre (≥ 3:1). */
const GLYPH_INK: Record<PinStatus, string> = {
  green: '#1D7A35',
  yellow: '#8A5A00',
  red: '#B42A2A',
  gray: '#56606A',
};

const GLYPH: Record<PinStatus, string> = {
  green: '<path d="M12.2 16.4l2.9 2.9 5.7-6" stroke-width="2.6"/>',
  yellow: '<path d="M16 11.6v5.4" stroke-width="2.6"/><circle cx="16" cy="20.4" r="1.5" data-fill="1"/>',
  red: '<path d="M12.6 12.6l6.8 6.8M19.4 12.6l-6.8 6.8" stroke-width="2.6"/>',
  gray: '<path d="M13.6 14a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.3" stroke-width="2.2"/><circle cx="16" cy="20.8" r="1.35" data-fill="1"/>',
};

function asStatus(status: string): PinStatus | null {
  return (KNOWN as readonly string[]).includes(status) ? (status as PinStatus) : null;
}

export function pinStatusText(status: string): string {
  const known = asStatus(status);
  return known ? statusLabel(known) : status;
}

export function pinAriaLabel(placeName: string, status: string): string {
  return `${placeName}, ${pinStatusText(status)}`;
}

/**
 * The pin's SVG. Built only from fixed shapes and palette colours — no
 * caller text — so it is safe to set as markup.
 */
export function pinSvgMarkup(status: string, rampType: string): string {
  const known = asStatus(status);
  const fill = known ? statusColor(known) : '#A0A8B0';
  const hasPortableRamp = rampType === 'portable_available' || rampType === 'portable_on_request';
  const rampCentre = hasPortableRamp && (status === 'green' || status === 'yellow');
  const centreFill = rampCentre ? RAMP_COLOR : '#FFFFFF';
  const ink = rampCentre ? '#FFFFFF' : known ? GLYPH_INK[known] : GLYPH_INK.gray;
  const glyph = (known ? GLYPH[known] : GLYPH.gray).replace(
    /<circle([^>]*) data-fill="1"\/>/g,
    `<circle$1 fill="${ink}" stroke="none"/>`,
  );

  return (
    '<svg class="map-pin-svg" width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path class="map-pin-body" d="M16 40.5C16 40.5 30.5 27.4 30.5 16C30.5 8 24 1.5 16 1.5C8 1.5 1.5 8 1.5 16C1.5 27.4 16 40.5 16 40.5Z" ' +
    `fill="${fill}" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="16" cy="16" r="8.6" fill="${centreFill}"/>` +
    `<g stroke="${ink}" stroke-linecap="round" stroke-linejoin="round" fill="none">${glyph}</g>` +
    '</svg>'
  );
}

/** DOM pin for MapLibre markers: root › button › wrapper › svg. */
export function createPinElement({
  placeName,
  status,
  rampType,
  isSelected,
  placeId,
}: PinMarkupInput): HTMLDivElement {
  const root = document.createElement('div');
  root.className = `goapsny-maplibre-marker${isSelected ? ' is-selected' : ''}`;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `map-pin-button${isSelected ? ' is-selected' : ''}`;
  button.dataset.placeId = placeId;
  button.setAttribute('aria-label', pinAriaLabel(placeName, status));

  const wrapper = document.createElement('span');
  wrapper.className = `map-pin-wrapper${isSelected ? ' is-selected' : ''}`;
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = pinSvgMarkup(status, rampType);

  button.append(wrapper);
  root.append(button);
  return root;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** The same pin as an HTML string, for map adapters that take markup. */
export function buildPinHtml({ placeName, status, rampType, isSelected, placeId }: PinMarkupInput): string {
  const selected = isSelected ? ' is-selected' : '';
  return `
    <button type="button" class="map-pin-button${selected}" data-place-id="${escapeAttr(placeId)}" aria-label="${escapeAttr(pinAriaLabel(placeName, status))}">
      <span class="map-pin-wrapper${selected}" aria-hidden="true">${pinSvgMarkup(status, rampType)}</span>
    </button>
  `;
}
