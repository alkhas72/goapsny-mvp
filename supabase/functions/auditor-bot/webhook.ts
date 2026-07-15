import type { TelegramUpdate } from "./types.ts";
import { timingSafeEqual } from "./validation.ts";

export function validateWebhookSecret(
  header: string | null,
  expected: string,
): { ok: true } | { ok: false; reason: "missing" | "wrong" } {
  if (!header) return { ok: false, reason: "missing" };
  if (!timingSafeEqual(header, expected)) return { ok: false, reason: "wrong" };
  return { ok: true };
}

export function parseTelegramUpdate(
  body: unknown,
): { ok: true; update: TelegramUpdate } | { ok: false; reason: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "malformed_update" };
  }
  const update = body as TelegramUpdate;
  if (typeof update.update_id !== "number") {
    return { ok: false, reason: "missing_update_id" };
  }
  if (!update.message && !update.callback_query) {
    return { ok: false, reason: "unsupported_update" };
  }
  return { ok: true, update };
}

export function extractTelegramId(update: TelegramUpdate): number | null {
  if (update.message?.from?.id) return update.message.from.id;
  if (update.callback_query?.from.id) return update.callback_query.from.id;
  return null;
}

export function extractChatId(update: TelegramUpdate): number | null {
  if (update.message?.chat.id) return update.message.chat.id;
  if (update.callback_query?.message?.chat.id) {
    return update.callback_query.message.chat.id;
  }
  return null;
}
