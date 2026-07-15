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

function isActionAllowed(
  state: string,
  action: string,
  _session: BotSession,
): boolean {
  if (action === "m:gray" || action === "m:add" || action === "m:edit") {
    return state === "menu";
  }
  if (action === "cf:no") return true;
  if (action === "cf:yes") {
    return ["verify_review", "edit_review", "create_photo"].includes(state);
  }
  if (action.startsWith("gp:")) return state === "verify_list";
  if (action.startsWith("gs:")) return state === "verify_list";
  if (action.startsWith("ep:")) return state === "edit_list";
  if (action.startsWith("es:")) return state === "edit_list";
  if (action.startsWith("st:")) return state === "verify_detail";
  if (action.startsWith("est:")) return state === "edit_status";
  if (action.startsWith("cat:")) return state === "create_category";
  if (action.startsWith("sk:")) {
    return state.startsWith("verify_facts_") ||
      state.startsWith("edit_facts_") ||
      state.startsWith("create_facts_");
  }
  if (
    action.startsWith("rt:") || action.startsWith("pk:") ||
    action.startsWith("te:") || action.startsWith("ta:") ||
    action.startsWith("el:")
  ) {
    return state.startsWith("verify_facts_") ||
      state.startsWith("edit_facts_") ||
      state.startsWith("create_facts_");
  }
  return false;
}

export function staleCallbackMessage(reason: "stale" | "wrong_state"): string {
  return reason === "stale"
    ? "Кнопка устарела. Начните заново через /start."
    : "Действие недоступно в текущем шаге. Используйте /start.";
}
