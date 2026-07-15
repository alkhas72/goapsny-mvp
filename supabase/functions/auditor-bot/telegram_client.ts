import type { OutgoingMessage, TelegramClient } from "./types.ts";

export class TelegramTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramTransportError";
  }
}

function assertTelegramOk(response: Response, action: string): void {
  if (response.ok) return;
  console.error("telegram_transport_failed", action, response.status);
  throw new TelegramTransportError(`telegram_${action}_failed`);
}

export function createTelegramClient(token: string): TelegramClient {
  const apiBase = `https://api.telegram.org/bot${token}`;
  return {
    async sendMessage(msg: OutgoingMessage) {
      const response = await fetch(`${apiBase}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: msg.chat_id,
          text: msg.text,
          reply_markup: msg.reply_markup,
        }),
      });
      assertTelegramOk(response, "send_message");
    },
    async sendPhoto(
      input: { chat_id: number; photo: string; caption?: string },
    ) {
      const response = await fetch(`${apiBase}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: input.chat_id,
          photo: input.photo,
          caption: input.caption,
        }),
      });
      assertTelegramOk(response, "send_photo");
    },
    async answerCallbackQuery(id: string, text?: string) {
      const response = await fetch(`${apiBase}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: id, text }),
      });
      assertTelegramOk(response, "answer_callback");
    },
    async getFile(fileId: string) {
      const response = await fetch(
        `${apiBase}/getFile?file_id=${encodeURIComponent(fileId)}`,
      );
      assertTelegramOk(response, "get_file");
      const payload = await response.json();
      if (!payload.ok) {
        throw new TelegramTransportError("telegram_get_file_failed");
      }
      return payload.result;
    },
    async downloadFile(filePath: string) {
      const response = await fetch(
        `https://api.telegram.org/file/bot${token}/${filePath}`,
      );
      assertTelegramOk(response, "download_file");
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}
