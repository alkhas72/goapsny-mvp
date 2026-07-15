import { assertEquals } from "@std/assert";
import { signCallback, validateCallback } from "./callbacks.ts";
import { newSession } from "./session.ts";

Deno.test("stale callback nonce is rejected", () => {
  const session = newSession(1);
  const stale = signCallback("cf:yes", "deadbeef");
  const result = validateCallback(session, stale);
  assertEquals(result.ok, false);
});

Deno.test("wrong state callback is rejected", () => {
  const session = newSession(1);
  const action = signCallback("cat:food", session.draft.nonce!);
  const result = validateCallback(session, action);
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "wrong_state");
});

Deno.test("menu action allowed only in menu state", () => {
  const session = newSession(1);
  const action = signCallback("m:gray", session.draft.nonce!);
  const result = validateCallback(session, action);
  assertEquals(result.ok, true);
});
