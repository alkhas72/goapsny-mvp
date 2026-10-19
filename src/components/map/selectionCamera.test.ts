import { describe, expect, it } from 'vitest';
import { selectedPinOffset, WIDE_LAYOUT_PX } from './selectionCamera';

describe('selectedPinOffset', () => {
  it('puts the pin in the middle of the map left visible above the card', () => {
    // Map 668 px high, card covers the lower 268 px: 400 px stay visible.
    const [, dy] = selectedPinOffset(390, 668, 268);
    const tipY = 668 / 2 + dy;
    expect(tipY).toBe(224);
    expect(tipY).toBeLessThan(668 - 268);
  });

  it('keeps the pin visible under a tall card, below the top buttons', () => {
    const [, dy] = selectedPinOffset(390, 668, 523);
    const tipY = 668 / 2 + dy;
    expect(tipY).toBeLessThan(668 - 523);
    expect(tipY - 48).toBeGreaterThanOrEqual(48);
  });

  it('assumes a half-height card before it is measured', () => {
    const [, dy] = selectedPinOffset(390, 600, 0);
    expect(600 / 2 + dy).toBe(174);
  });

  it('shifts the pin left when the card is a side panel', () => {
    expect(selectedPinOffset(WIDE_LAYOUT_PX + 232, 700, 0)).toEqual([-190, 0]);
  });

  it('does nothing for a map without size', () => {
    expect(selectedPinOffset(0, 0, 0)).toEqual([0, 0]);
  });
});
