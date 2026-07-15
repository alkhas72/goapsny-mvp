import { assertEquals } from "@std/assert";
import {
  createTelegramClient,
  TelegramTransportError,
} from "./telegram_client.ts";

Deno.test("telegram client throws on send failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(new Response("fail", { status: 500 }));
  try {
    const client = createTelegramClient("test-token");
    let threw = false;
    try {
      await client.sendMessage({ chat_id: 1, text: "hi" });
    } catch (error) {
      threw = error instanceof TelegramTransportError;
    }
    assertEquals(threw, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
