/**
 * The mapper's day: every place added today, one line each, plus karma.
 * Prototype store — per device; the live version reads the author's own
 * submissions from the server (moderation keeps them "на проверке").
 */
import type { AccessibilityStatus } from '../../shared/index';
import { KARMA_AWARDS } from '../../shared/index';

export interface DayEntry {
  id: string;
  at: string;
  name: string;
  subtype: string | null;
  status: Exclude<AccessibilityStatus, 'gray'>;
  reason: string;
  photos: number;
  karma: number;
}

const KEY = 'goapsny.mapperDay';
/** Karma the demo mapper already has, so the ladder shows movement. */
export const DEMO_START_KARMA = 85;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function readDay(): DayEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as { day: string; entries: DayEntry[] };
    return v.day === today() ? v.entries : [];
  } catch {
    return [];
  }
}

export function appendDay(entry: Omit<DayEntry, 'id' | 'at' | 'karma'>, fullCard: boolean): DayEntry[] {
  const karma =
    KARMA_AWARDS.place_created + KARMA_AWARDS.photo_added * entry.photos + (fullCard ? KARMA_AWARDS.full_card_bonus : 0);
  const next: DayEntry = { ...entry, id: crypto.randomUUID(), at: new Date().toISOString(), karma };
  const entries = [...readDay(), next];
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ day: today(), entries }));
  } catch {
    // Storage blocked: the day list lives only in this session.
  }
  return entries;
}

export function dayKarma(entries: DayEntry[]): number {
  return entries.reduce((sum, e) => sum + e.karma, 0);
}
