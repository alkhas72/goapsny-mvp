import { describe, expect, it } from 'vitest';
import { buildPinHtml } from './pinMarkup';

describe('buildPinHtml', () => {
  it('renders accessible pin button with status color and label', () => {
    const html = buildPinHtml({
      placeName: 'Кафе',
      status: 'green',
      rampType: 'permanent',
      isSelected: false,
      placeId: 'place-1',
    });

    expect(html).toContain('data-place-id="place-1"');
    expect(html).toContain('class="map-pin-button');
    expect(html).toContain('aria-label="Кафе, Доступно"');
    expect(html).toContain('fill="#2EA84A"');
  });

  it('uses purple center for portable ramp on accessible statuses', () => {
    const html = buildPinHtml({
      placeName: 'Магазин',
      status: 'yellow',
      rampType: 'portable_available',
      isSelected: true,
      placeId: 'place-2',
    });

    expect(html).toContain('fill="#7A5AF8"');
    expect(html).toContain('is-selected');
  });

  it('escapes unsafe characters in aria-label', () => {
    const html = buildPinHtml({
      placeName: 'Cafe "Test" & Co',
      status: 'gray',
      rampType: 'none',
      isSelected: false,
      placeId: 'x',
    });

    expect(html).toContain('aria-label="Cafe &quot;Test&quot; &amp; Co,');
    expect(html).not.toContain('aria-label="Cafe "Test"');
  });
});
