import { assertEquals } from "@std/assert";
import {
  AUDITOR_TELEGRAM_BOT_TOKEN,
  AUDITOR_TELEGRAM_WEBHOOK_SECRET,
  readAuditorBotToken,
} from "./env.ts";

Deno.test("readAuditorBotToken requires dedicated env", () => {
  const saved = Deno.env.get(AUDITOR_TELEGRAM_BOT_TOKEN);
  const legacy = Deno.env.get("TELEGRAM_BOT_TOKEN");
  Deno.env.delete(AUDITOR_TELEGRAM_BOT_TOKEN);
  Deno.env.set("TELEGRAM_BOT_TOKEN", "product-bot");
  try {
    let error = "";
    try {
      readAuditorBotToken();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "unknown";
    }
    assertEquals(error, `Missing env: ${AUDITOR_TELEGRAM_BOT_TOKEN}`);
  } finally {
    if (saved) Deno.env.set(AUDITOR_TELEGRAM_BOT_TOKEN, saved);
    else Deno.env.delete(AUDITOR_TELEGRAM_BOT_TOKEN);
    if (legacy) Deno.env.set("TELEGRAM_BOT_TOKEN", legacy);
    else Deno.env.delete("TELEGRAM_BOT_TOKEN");
  }
});

Deno.test("auditor secret names are distinct from product bot", () => {
  assertEquals(AUDITOR_TELEGRAM_BOT_TOKEN, "AUDITOR_TELEGRAM_BOT_TOKEN");
  assertEquals(
    AUDITOR_TELEGRAM_WEBHOOK_SECRET,
    "AUDITOR_TELEGRAM_WEBHOOK_SECRET",
  );
});
