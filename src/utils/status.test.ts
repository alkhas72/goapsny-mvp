import { describe, expect, it } from 'vitest';
import { STATUS_META } from '../shared/index';
import { statusColor, statusLabel } from './status';

describe('status word+color rendering', () => {
  it('returns Russian label and canonical color for gray', () => {
    expect(statusLabel('gray')).toBe(STATUS_META.gray.ru);
    expect(statusColor('gray')).toBe('#A0A8B0');
  });

  it('keeps red visible with explicit label', () => {
    expect(statusLabel('red')).toBe('Недоступно');
    expect(statusColor('red')).toBe('#E24B4A');
  });
});
