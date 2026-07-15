import type { OutgoingMessage } from "./types.ts";
import type { HandlerDeps } from "./handler_deps.ts";
import { resetSession as resetBotSession, withSession } from "./session.ts";

export { resetBotSession as resetSession, withSession };

export function requireNonce(
  session: { draft: { nonce?: string } },
): string {
  return session.draft.nonce ?? crypto.randomUUID().slice(0, 8);
}

export async function send(
  deps: HandlerDeps,
  chatId: number,
  text: string,
  reply_markup?: OutgoingMessage["reply_markup"],
) {
  await deps.telegram.sendMessage({ chat_id: chatId, text, reply_markup });
}
