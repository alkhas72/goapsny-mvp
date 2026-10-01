import type { AccessibilityStatus } from '../shared/index';
import { STATUS_META } from '../shared/index';

export function statusLabel(status: AccessibilityStatus): string {
  return STATUS_META[status].ru;
}

export function statusColor(status: AccessibilityStatus): string {
  return STATUS_META[status].color;
}

export const RAMP_COLOR = '#EF705D';
