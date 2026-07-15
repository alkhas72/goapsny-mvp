import { assertEquals } from "@std/assert";
import { signCallback } from "./callbacks.ts";
import { handleAuthorizedUpdate } from "./handler.ts";
import { newSession } from "./session.ts";
import {
  makePlace,
  makeProfile,
  MemoryPlacesStore,
  MemorySessionStore,
  MemoryStorage,
  RecordingTelegram,
} from "./test_helpers.ts";

Deno.test("start shows menu for authorized auditor", async () => {
  const telegram = new RecordingTelegram();
  const profile = makeProfile();
  const session = newSession(profile.telegram_id);
  const updated = await handleAuthorizedUpdate(
    {
      places: new MemoryPlacesStore(),
      sessions: new MemorySessionStore(),
      storage: new MemoryStorage(),
      telegram,
    },
    profile,
    {
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 500 },
        from: { id: profile.telegram_id },
        text: "/start",
      },
    },
    session,
  );
  assertEquals(updated.state, "menu");
  assertEquals(telegram.messages.length > 0, true);
  assertEquals(telegram.messages[0]?.reply_markup?.inline_keyboard?.length, 3);
});

Deno.test("gray list callback binds only published gray ids", async () => {
  const gray = makePlace({ status: "gray", moderation_status: "published" });
  const hidden = makePlace({ status: "gray", moderation_status: "hidden" });
  const telegram = new RecordingTelegram();
  const profile = makeProfile();
  let session = newSession(profile.telegram_id);
  const places = new MemoryPlacesStore([gray, hidden]);
  session = await handleAuthorizedUpdate(
    {
      places,
      sessions: new MemorySessionStore(),
      storage: new MemoryStorage(),
      telegram,
    },
    profile,
    {
      update_id: 2,
      callback_query: {
        id: "cb1",
        from: { id: profile.telegram_id },
        message: { message_id: 2, chat: { id: 500 } },
        data: signCallback("m:gray", session.draft.nonce!),
      },
    },
    session,
  );
  assertEquals(session.draft.grayIds, [gray.id]);
});

Deno.test("stale callback does not mutate session flow", async () => {
  const telegram = new RecordingTelegram();
  const profile = makeProfile();
  let session = newSession(profile.telegram_id);
  session = {
    ...session,
    state: "create_name",
    draft: { ...session.draft, flow: "create", nonce: session.draft.nonce },
  };
  const stale = signCallback("cf:yes", "00000000");
  await handleAuthorizedUpdate(
    {
      places: new MemoryPlacesStore(),
      sessions: new MemorySessionStore(),
      storage: new MemoryStorage(),
      telegram,
    },
    profile,
    {
      update_id: 4,
      callback_query: {
        id: "cb3",
        from: { id: profile.telegram_id },
        message: { message_id: 4, chat: { id: 500 } },
        data: stale,
      },
    },
    session,
  );
  assertEquals(session.state, "create_name");
});

Deno.test("foreign callback ownership is rejected", async () => {
  const telegram = new RecordingTelegram();
  const profile = makeProfile({ telegram_id: 1 });
  const session = newSession(1);
  await handleAuthorizedUpdate(
    {
      places: new MemoryPlacesStore(),
      sessions: new MemorySessionStore(),
      storage: new MemoryStorage(),
      telegram,
    },
    profile,
    {
      update_id: 3,
      callback_query: {
        id: "cb2",
        from: { id: 999 },
        message: { message_id: 3, chat: { id: 500 } },
        data: "m:gray",
      },
    },
    session,
  );
  assertEquals(telegram.callbacks.includes("cb2"), true);
});
