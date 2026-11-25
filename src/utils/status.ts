import type { AccessibilityStatus } from '../shared/index';
import { STATUS_META } from '../shared/index';

export function statusLabel(status: AccessibilityStatus): string {
  return STATUS_META[status].ru;
}

export function statusColor(status: AccessibilityStatus): string {
  return STATUS_META[status].color;
}

// Слово Алхаса 2026-11-23: центр пина при приставном пандусе пурпурный (тот же цвет — точка в Stopgap).
export const RAMP_COLOR = '#7A5AF8';
