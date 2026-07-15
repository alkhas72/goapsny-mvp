import { assertEquals } from "@std/assert";
import { signCallback, validateCallback } from "./callbacks.ts";
import { factState } from "./facts.ts";
import { newSession, withSession } from "./session.ts";

Deno.test("create_status accepts st:green with current nonce", () => {
  const session = withSession(newSession(1), {
    state: "create_status",
    draft: {
      flow: "create",
      step: "status",
      pendingPlaceId: crypto.randomUUID(),
      nonce: "abc12345",
    },
  });
  const result = validateCallback(
    session,
    signCallback("st:green", session.draft.nonce!),
  );
  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.action, "st:green");
});

Deno.test("prior fact step keyboard rejected after advancing", () => {
  const session = withSession(newSession(1), {
    state: factState(
      {
        telegram_id: 1,
        state: "create_facts_parking",
        draft: {
          flow: "create",
          step: "parking",
          nonce: "deadbeef",
        },
        last_update_id: null,
      },
      "parking",
    ),
    draft: {
      flow: "create",
      step: "parking",
      nonce: "deadbeef",
    },
  });
  const priorRamp = validateCallback(session, signCallback("rt:none", "deadbeef"));
  assertEquals(priorRamp.ok, false);
  if (!priorRamp.ok) assertEquals(priorRamp.reason, "wrong_state");

  const priorSkip = validateCallback(
    session,
    signCallback("sk:steps_count", "deadbeef"),
  );
  assertEquals(priorSkip.ok, false);

  const current = validateCallback(session, signCallback("pk:yes", "deadbeef"));
  assertEquals(current.ok, true);
});

Deno.test("cf:no rejected during active fact step", () => {
  const session = withSession(newSession(1), {
    state: factState(
      {
        telegram_id: 1,
        state: "verify_facts_ramp_type",
        draft: { flow: "verify", step: "ramp_type", nonce: "cafebabe" },
        last_update_id: null,
      },
      "ramp_type",
    ),
    draft: { flow: "verify", step: "ramp_type", nonce: "cafebabe" },
  });
  const result = validateCallback(session, signCallback("cf:no", "cafebabe"));
  assertEquals(result.ok, false);
});
