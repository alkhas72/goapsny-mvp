import { factState } from "./facts.ts";
import type { BotSession } from "./types.ts";

export function createSessionNonce(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8);
}

export function signCallback(action: string, nonce: string): string {
  return `${action}:${nonce}`;
}

export function validateCallback(
  session: BotSession,
  data: string,
): { ok: true; action: string } | {
  ok: false;
  reason: "stale" | "wrong_state";
} {
  const nonce = session.draft.nonce;
  if (!nonce || !data.endsWith(`:${nonce}`)) {
    return { ok: false, reason: "stale" };
  }
  const action = data.slice(0, -(nonce.length + 1));
  if (!isActionAllowed(session.state, action, session)) {
    return { ok: false, reason: "wrong_state" };
  }
  return { ok: true, action };
}

const CANCEL_ALLOWED_STATES = new Set([
  "menu",
  "verify_list",
  "edit_list",
  "verify_detail",
  "edit_detail",
  "edit_status",
  "create_category",
  "create_name",
  "create_location",
  "create_status",
  "verify_review",
  "edit_review",
  "create_photo",
]);

const ENUM_PREFIX_TO_STEP: Record<string, string> = {
  rt: "ramp_type",
  pk: "parking",
  te: "toilet_exists",
  ta: "toilet_accessible",
  el: "elevator",
};

function isExactFactStep(session: BotSession, step: string): boolean {
  return session.state === factState(session, step) &&
    session.draft.step === step;
}

function isActionAllowed(
  state: string,
  action: string,
  session: BotSession,
): boolean {
  if (action === "m:gray" || action === "m:add" || action === "m:edit") {
    return state === "menu";
  }
  if (action === "cf:no") return CANCEL_ALLOWED_STATES.has(state);
  if (action === "cf:yes") {
    return ["verify_review", "edit_review", "create_photo"].includes(state);
  }
  if (action.startsWith("gp:")) return state === "verify_list";
  if (action.startsWith("gs:")) return state === "verify_list";
  if (action.startsWith("ep:")) return state === "edit_list";
  if (action.startsWith("es:")) return state === "edit_list";
  if (action.startsWith("st:")) {
    return state === "verify_detail" || state === "create_status";
  }
  if (action.startsWith("est:")) return state === "edit_status";
  if (action.startsWith("cat:")) return state === "create_category";
  if (action.startsWith("sk:")) {
    const step = action.slice(3);
    return isExactFactStep(session, step);
  }
  for (const [prefix, step] of Object.entries(ENUM_PREFIX_TO_STEP)) {
    if (action.startsWith(`${prefix}:`)) {
      return isExactFactStep(session, step);
    }
  }
  return false;
}

export function staleCallbackMessage(reason: "stale" | "wrong_state"): string {
  return reason === "stale"
    ? "Кнопка устарела. Начните заново через /start."
    : "Действие недоступно в текущем шаге. Используйте /start.";
}
