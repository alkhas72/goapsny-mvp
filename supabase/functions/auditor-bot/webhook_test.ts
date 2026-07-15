import { assertEquals } from "@std/assert";
import {
  extractTelegramId,
  parseTelegramUpdate,
  validateWebhookSecret,
} from "./webhook.ts";

Deno.test("missing webhook secret is rejected", () => {
  assertEquals(validateWebhookSecret(null, "secret").ok, false);
});

Deno.test("wrong webhook secret is rejected", () => {
  const result = validateWebhookSecret("wrong", "secret");
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "wrong");
});

Deno.test("correct webhook secret passes", () => {
  assertEquals(validateWebhookSecret("secret", "secret").ok, true);
});

Deno.test("malformed update is rejected", () => {
  assertEquals(parseTelegramUpdate(null).ok, false);
  assertEquals(parseTelegramUpdate({}).ok, false);
});

Deno.test("valid message update parses", () => {
  const parsed = parseTelegramUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      chat: { id: 10 },
      from: { id: 99 },
      text: "/start",
    },
  });
  assertEquals(parsed.ok, true);
  if (parsed.ok) assertEquals(extractTelegramId(parsed.update), 99);
});
