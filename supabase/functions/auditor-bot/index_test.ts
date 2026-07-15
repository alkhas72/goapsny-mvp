import { assertEquals } from "@std/assert";
import { handleWebhookRequest } from "./index.ts";
import { AUDITOR_TELEGRAM_WEBHOOK_SECRET } from "./env.ts";

function saveEnv(name: string): string | undefined {
  const value = Deno.env.get(name);
  if (value === undefined) Deno.env.delete(name);
  return value;
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) Deno.env.delete(name);
  else Deno.env.set(name, value);
}

Deno.test("index rejects missing auditor webhook secret", async () => {
  const auditorSecret = saveEnv(AUDITOR_TELEGRAM_WEBHOOK_SECRET);
  const legacy = saveEnv("TELEGRAM_WEBHOOK_SECRET");
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "legacy-only");
  try {
    const response = await handleWebhookRequest(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          update_id: 1,
          message: { message_id: 1, chat: { id: 1 }, from: { id: 1 } },
        }),
      }),
    );
    assertEquals(response.status, 500);
  } finally {
    restoreEnv(AUDITOR_TELEGRAM_WEBHOOK_SECRET, auditorSecret);
    restoreEnv("TELEGRAM_WEBHOOK_SECRET", legacy);
  }
});

Deno.test("index rejects wrong auditor webhook secret", async () => {
  const auditorSecret = saveEnv(AUDITOR_TELEGRAM_WEBHOOK_SECRET);
  Deno.env.set(AUDITOR_TELEGRAM_WEBHOOK_SECRET, "auditor-secret");
  try {
    const response = await handleWebhookRequest(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Bot-Api-Secret-Token": "wrong",
        },
        body: JSON.stringify({
          update_id: 1,
          message: { message_id: 1, chat: { id: 1 }, from: { id: 1 } },
        }),
      }),
    );
    assertEquals(response.status, 403);
  } finally {
    restoreEnv(AUDITOR_TELEGRAM_WEBHOOK_SECRET, auditorSecret);
  }
});
