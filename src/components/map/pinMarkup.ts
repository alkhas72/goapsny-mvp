import type { AccessibilityStatus } from '../../shared/index';
import { statusColor, statusLabel } from '../../utils/status';

export interface PinMarkupInput {
  placeName: string;
  status: string;
  rampType: string;
  isSelected: boolean;
  placeId: string;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function buildPinHtml({
  placeName,
  status,
  rampType,
  isSelected,
  placeId,
}: PinMarkupInput): string {
  const statusColorValue =
    status === 'green' || status === 'yellow' || status === 'red' || status === 'gray'
      ? statusColor(status as AccessibilityStatus)
      : '#A0A8B0';
  const hasPortableRamp = rampType === 'portable_available' || rampType === 'portable_on_request';
  const isPurpleCenter = hasPortableRamp && (status === 'green' || status === 'yellow');
  const centerFill = isPurpleCenter ? '#7A5AF8' : '#FFFFFF';
  const centerStroke = isPurpleCenter ? 'stroke="#FFFFFF" stroke-width="2.5"' : '';
  const label = escapeAttr(`${placeName}, ${statusLabel(status as AccessibilityStatus)}`);

  return `
    <button type="button" class="map-pin-button ${isSelected ? 'is-selected' : ''}" data-place-id="${placeId}" aria-label="${label}">
      <span class="map-pin-wrapper ${isSelected ? 'is-selected' : ''}" aria-hidden="true">
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 36C14 36 27 24 27 14C27 6.8 21.2 1 14 1C6.8 1 1 6.8 1 14C1 24 14 36 14 36Z" fill="${statusColorValue}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
          <circle cx="14" cy="14" r="5.5" fill="${centerFill}" ${centerStroke}/>
        </svg>
      </span>
    </button>
  `;
}
