import { createSessionNonce } from "./callbacks.ts";
import type { BotSession, SessionDraft } from "./types.ts";

export type SessionStore = {
  get(telegramId: number): Promise<BotSession | null>;
  upsert(session: BotSession): Promise<void>;
  clear(telegramId: number): Promise<void>;
};

export function newSession(telegramId: number): BotSession {
  return {
    telegram_id: telegramId,
    state: "menu",
    draft: { nonce: createSessionNonce() },
    last_update_id: null,
  };
}

export function withSession(
  session: BotSession,
  patch: Partial<Pick<BotSession, "state" | "draft" | "last_update_id">>,
): BotSession {
  return {
    ...session,
    ...patch,
    draft: patch.draft ? { ...session.draft, ...patch.draft } : session.draft,
  };
}

export function resetSession(session: BotSession): BotSession {
  return {
    ...session,
    state: "menu",
    draft: { nonce: createSessionNonce() },
  };
}

function withFlowNonce(draft: SessionDraft): SessionDraft {
  return { ...draft, nonce: createSessionNonce() };
}

export function startVerifyFlow(
  session: BotSession,
  grayIds: string[],
  page: number,
): BotSession {
  const draft: SessionDraft = withFlowNonce({
    flow: "verify",
    step: "list",
    grayIds,
    grayPage: page,
  });
  return withSession(session, { state: "verify_list", draft });
}

export function startCreateFlow(
  session: BotSession,
  placeId: string,
): BotSession {
  const draft: SessionDraft = withFlowNonce({
    flow: "create",
    step: "category",
    pendingPlaceId: placeId,
    audit: {},
  });
  return withSession(session, { state: "create_category", draft });
}

export function startEditFlow(
  session: BotSession,
  editIds: string[],
  page: number,
): BotSession {
  const draft: SessionDraft = withFlowNonce({
    flow: "edit",
    step: "list",
    editIds,
    editPage: page,
  });
  return withSession(session, { state: "edit_list", draft });
}

export function bindSelectedPlace(
  session: BotSession,
  placeId: string,
): BotSession {
  return withSession(session, {
    state: session.draft.flow === "edit" ? "edit_detail" : "verify_detail",
    draft: { ...session.draft, placeId, step: "detail" },
  });
}

export function isSessionExpired(
  updatedAt: string | undefined,
  maxAgeMs = 1000 * 60 * 60 * 24,
): boolean {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() > maxAgeMs;
}
