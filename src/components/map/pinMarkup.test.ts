import { describe, expect, it } from 'vitest';
import { buildPinHtml } from './pinMarkup';
import { RAMP_COLOR } from '../../utils/status';

const pin = (status: string, rampType: string) =>
  buildPinHtml({ placeName: 'Кафе', status, rampType, isSelected: false, placeId: 'p1' });

describe('buildPinHtml: центр пина', () => {
  it('без приставного пандуса центр белый', () => {
    expect(pin('green', 'none')).toContain('r="5.5" fill="#FFFFFF"');
    expect(pin('green', 'permanent')).toContain('r="5.5" fill="#FFFFFF"');
  });

  it.each(['green', 'yellow', 'red', 'gray'])(
    'приставной пандус даёт пурпурный центр при статусе %s',
    (status) => {
      expect(pin(status, 'portable_on_request')).toContain(`r="5.5" fill="${RAMP_COLOR}"`);
      expect(pin(status, 'portable_available')).toContain(`r="5.5" fill="${RAMP_COLOR}"`);
    },
  );

  it('цвет пандуса общий со Stopgap', () => {
    expect(RAMP_COLOR).toBe('#7A5AF8');
  });
});
