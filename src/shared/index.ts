// GoApsny v1 — shared contract (single source of truth for frontend + backend)
// Author: Claude (hub). Keep Antigravity's api.ts and Codex's Edge Function
// responses aligned to this file. Slugs match Codex's migration + seed (2026-06-01).

// ---- Accessibility status (traffic light) ----
export type AccessibilityStatus = 'green' | 'yellow' | 'red' | 'gray';

export interface StatusMeta {
  ru: string;
  description: string;
  color: string;
  wheelchairTag: string | null;
  operatorSelectable: boolean;
}

export const STATUS_META: Record<AccessibilityStatus, StatusMeta> = {
  green: { ru: 'Доступно', description: 'вход, зал и туалет доступны', color: '#2EA84A', wheelchairTag: 'yes', operatorSelectable: true },
  yellow: { ru: 'Частично', description: 'въезд есть, но с ограничениями', color: '#EBA92B', wheelchairTag: 'limited', operatorSelectable: true },
  red: { ru: 'Недоступно', description: 'входная группа недоступна', color: '#E24B4A', wheelchairTag: 'no', operatorSelectable: true },
  gray: { ru: 'Не обследовано', description: 'зарезервировано: импорт/публичные точки', color: '#A0A8B0', wheelchairTag: 'unknown', operatorSelectable: false },
};

// Statuses an operator may pick in v1 (gray is reserved, not offered).
export const OPERATOR_STATUSES: AccessibilityStatus[] = ['green', 'yellow', 'red'];

// ---- Karma ladder (MUST match backend public.karma_status_for) ----
export interface KarmaLevel {
  slug: string;
  ru: string;
  threshold: number;
}

export const KARMA_LEVELS: KarmaLevel[] = [
  { slug: 'pedestrian', ru: 'Пешеход', threshold: 0 },
  { slug: 'explorer', ru: 'Исследователь', threshold: 30 },
  { slug: 'cartographer', ru: 'Картограф', threshold: 100 },
  { slug: 'guide', ru: 'Проводник', threshold: 250 },
  { slug: 'city_expert', ru: 'Знаток города', threshold: 500 },
  { slug: 'accessibility_keeper', ru: 'Хранитель доступности', threshold: 1000 },
  { slug: 'legend', ru: 'Легенда GoApsny', threshold: 1800 },
];

// Karma awarded per action (MUST match backend triggers).
export const KARMA_AWARDS = {
  place_created: 10,
  photo_added: 5,
  full_card_bonus: 10,
} as const;

export function karmaLevelFor(total: number): KarmaLevel {
  let current = KARMA_LEVELS[0];
  for (const level of KARMA_LEVELS) {
    if (total >= level.threshold) current = level;
  }
  return current;
}

export function karmaNext(total: number): { next: KarmaLevel | null; remaining: number } {
  const next = KARMA_LEVELS.find((l) => l.threshold > total) ?? null;
  return { next, remaining: next ? next.threshold - total : 0 };
}

// ---- Categories (Wheelmap taxonomy, 12; slugs match Codex seed) ----
export interface Category {
  slug: string;
  ru: string;
  wheelmapGroup: string;
  icon: string; // Lucide icon name (frontend)
}

export const CATEGORIES: Category[] = [
  { slug: 'public_transport', ru: 'Общественный транспорт', wheelmapGroup: 'public_transport', icon: 'bus' },
  { slug: 'food', ru: 'Питание', wheelmapGroup: 'food', icon: 'utensils' },
  { slug: 'leisure', ru: 'Досуг', wheelmapGroup: 'leisure', icon: 'ticket' },
  { slug: 'bank_post', ru: 'Банки и почта', wheelmapGroup: 'bank_post', icon: 'landmark' },
  { slug: 'shops', ru: 'Магазины', wheelmapGroup: 'shops', icon: 'shopping-bag' },
  { slug: 'education', ru: 'Образование', wheelmapGroup: 'education', icon: 'graduation-cap' },
  { slug: 'sport', ru: 'Спорт', wheelmapGroup: 'sport', icon: 'dumbbell' },
  { slug: 'tourism', ru: 'Туризм', wheelmapGroup: 'tourism', icon: 'map' },
  { slug: 'accommodation', ru: 'Гостиницы', wheelmapGroup: 'accommodation', icon: 'hotel' },
  { slug: 'government', ru: 'Госучреждения', wheelmapGroup: 'government', icon: 'building-2' },
  { slug: 'health', ru: 'Здравоохранение', wheelmapGroup: 'health', icon: 'hospital' },
  { slug: 'other', ru: 'Прочее', wheelmapGroup: 'other', icon: 'map-pin' },
];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

// ---- Core entities (match Codex migration 0001) ----
export type Role = 'owner' | 'admin' | 'operator' | 'tester' | 'public_user' | 'banned';
export type RampType = 'none' | 'permanent' | 'portable_on_request' | 'portable_available';
export type YesNoUnknown = 'yes' | 'no' | 'unknown';
export type ToiletAccessible = 'yes' | 'no' | 'partial' | 'unknown';
export type PhotoKind = 'facade' | 'steps' | 'ramp' | 'toilet' | 'interior';
export type ModerationStatus = 'published' | 'pending' | 'hidden';

export interface Profile {
  id: string;
  telegram_id: number | null;
  username: string | null;
  display_name: string | null;
  role: Role;
  trust_level: number;
  ai_enabled: boolean;
  karma: number;
  karma_status: string;
}

export interface Place {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  status: AccessibilityStatus;
  steps_count: number | null;
  step_height_cm: number | null;
  ramp_type: RampType;
  door_width_cm: number | null;
  entrance_notes: string | null;
  toilet_exists: YesNoUnknown;
  toilet_accessible: ToiletAccessible;
  parking: YesNoUnknown;
  comment: string | null;
  osm_tags: Record<string, string>;
  details: Record<string, unknown>;
  moderation_status: ModerationStatus;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  place_id: string;
  storage_path: string;
  kind: PhotoKind;
  uploaded_by: string | null;
  created_at: string;
}

// ---- API contract (frontend api.ts implements; backend must satisfy) ----
export interface AutofillDraft {
  name: string | null;
  category: string | null;
  steps_visible: number | null;
  ramp_visible: boolean | null;
  entrance_level: 'level' | 'steps' | null;
  ramp_type?: RampType;
  status?: AccessibilityStatus;
}

export interface AutofillResult {
  status: 'ok' | 'blocked_budget' | 'error';
  draft?: AutofillDraft;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  profile: Profile;
}

// What the H0 client sends to api.createPlace. The API layer resolves
// created_by from auth.uid(); DB defaults/triggers fill osm_tags, details,
// moderation_status, source, timestamps. Photo upload is out of H0.
export interface NewPlaceInput {
  name: string;
  category: string;
  lat: number;
  lng: number;
  status: Exclude<AccessibilityStatus, 'gray'>;
  stepsCount?: number | null;
  stepHeightCm?: number | null;
  rampType?: RampType;
  doorWidthCm?: number | null;
  entranceNotes?: string | null;
  toiletExists?: YesNoUnknown;
  toiletAccessible?: ToiletAccessible;
  parking?: YesNoUnknown;
  comment?: string | null;
}

export interface GoApsnyApi {
  loginTelegram(initData: string): Promise<AuthResponse>;
  getPlaces(): Promise<Place[]>;
  createPlace(input: NewPlaceInput): Promise<Place>;
  getAiAutofill(photoPath: string, placeId?: string): Promise<AutofillResult>;
}

// ---- Theme tokens (both themes; status colors stay constant) ----
export const THEME = {
  light: { accent: '#E2741C', bg: '#FFFFFF', surface: '#F4ECE4', text: '#2A2017', textSecondary: '#A1897A', border: '#EFE3D9' },
  dark: { accent: '#4BA4DD', bg: '#0F1A24', surface: '#1B2A38', text: '#E8EEF3', textSecondary: '#8FA3B5', border: '#24384A', pattern: '#16273A' },
  youAreHere: '#2D7FF9',
} as const;
