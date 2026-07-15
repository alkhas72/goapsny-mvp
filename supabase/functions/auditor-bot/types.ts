import type { AUDITOR_ROLES, FINAL_STATUSES } from "./constants.ts";

export type AuditorRole = (typeof AUDITOR_ROLES)[number];
export type FinalStatus = (typeof FINAL_STATUSES)[number];

export type Profile = {
  id: string;
  telegram_id: number;
  role: string;
  display_name: string | null;
};

export type PlaceRow = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  status: string;
  steps_count: number | null;
  step_height_cm: number | null;
  ramp_type: string;
  door_width_cm: number | null;
  entrance_notes: string | null;
  toilet_exists: string;
  toilet_accessible: string;
  parking: string;
  comment: string | null;
  details: Record<string, unknown>;
  moderation_status: string;
  source: string;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PhotoRow = {
  id: string;
  place_id: string;
  storage_path: string;
  kind: string;
  uploaded_by: string | null;
};

export type AuditFields = {
  steps_count: number | null;
  step_height_cm: number | null;
  ramp_type: string;
  door_width_cm: number | null;
  entrance_notes: string | null;
  toilet_exists: string;
  toilet_accessible: string;
  parking: string;
  comment: string | null;
};

export type VerificationDetails = {
  schema_version: 1;
  address?: string;
  elevator?: "yes" | "no" | "unknown";
  verification?: {
    verified_at: string;
    verified_by_role: "auditor";
  };
  external_links?: Record<string, string>;
  [key: string]: unknown;
};

export type SessionDraft = {
  flow?: "verify" | "create" | "edit";
  step?: string;
  placeId?: string;
  grayIds?: string[];
  editIds?: string[];
  grayPage?: number;
  editPage?: number;
  name?: string;
  category?: string;
  lat?: number;
  lng?: number;
  status?: FinalStatus;
  audit?: Partial<AuditFields>;
  address?: string;
  elevator?: "yes" | "no" | "unknown";
  facadeUploaded?: boolean;
  pendingPlaceId?: string;
  nonce?: string;
};

export type BotSession = {
  telegram_id: number;
  state: string;
  draft: SessionDraft;
  last_update_id: number | null;
  updated_at?: string;
};

export type TelegramUser = {
  id: number;
  first_name?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number };
  text?: string;
  location?: { latitude: number; longitude: number };
  photo?: Array<{ file_id: string; width: number; height: number }>;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type OutgoingMessage = {
  chat_id: number;
  text: string;
  reply_markup?: InlineKeyboard;
};

export type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

export type TelegramClient = {
  sendMessage(msg: OutgoingMessage): Promise<void>;
  sendPhoto(
    input: { chat_id: number; photo: string; caption?: string },
  ): Promise<void>;
  answerCallbackQuery(id: string, text?: string): Promise<void>;
  getFile(fileId: string): Promise<{ file_path: string }>;
  downloadFile(filePath: string): Promise<Uint8Array>;
};
