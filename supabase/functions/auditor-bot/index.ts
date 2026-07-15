import { createClient } from "@supabase/supabase-js";
import { resolveAuditorAccess } from "./auth.ts";
import {
  readAuditorBotToken,
  readAuditorWebhookSecret,
  requireAuditorEnv,
} from "./env.ts";
import {
  bootstrapSession,
  handleAuthorizedUpdate,
  handleUnauthorized,
} from "./handler.ts";
import type { ClaimIdentity } from "./idempotency.ts";
import {
  createIdempotencyStore,
  createPlacesStore,
  createSessionStore,
  createStorageClient,
  resolveProfileByTelegramId,
} from "./supabase_stores.ts";
import { createTelegramClient } from "./telegram_client.ts";
import {
  extractChatId,
  extractTelegramId,
  parseTelegramUpdate,
  validateWebhookSecret,
} from "./webhook.ts";

export { readAuditorBotToken, readAuditorWebhookSecret, requireAuditorEnv };

function newClaimIdentity(): ClaimIdentity {
  return {
    owner: crypto.randomUUID(),
    attempt: crypto.randomUUID(),
  };
}

export async function handleWebhookRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
    });
  }

  let webhookSecret: string;
  try {
    webhookSecret = readAuditorWebhookSecret();
  } catch {
    return new Response(JSON.stringify({ error: "misconfigured" }), {
      status: 500,
    });
  }

  const secretCheck = validateWebhookSecret(
    req.headers.get("X-Telegram-Bot-Api-Secret-Token"),
    webhookSecret,
  );
  if (!secretCheck.ok) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: secretCheck.reason === "missing" ? 401 : 403,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "malformed_update" }), {
      status: 400,
    });
  }

  const parsed = parseTelegramUpdate(body);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.reason }), {
      status: 400,
    });
  }

  const admin = createClient(
    requireAuditorEnv("SUPABASE_URL"),
    requireAuditorEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  const idempotency = createIdempotencyStore(admin);
  const claimIdentity = newClaimIdentity();
  const claim = await idempotency.claimUpdate(
    parsed.update.update_id,
    claimIdentity,
  );
  if (claim === "completed") {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      status: 200,
    });
  }
  if (claim === "processing") {
    return new Response(JSON.stringify({ error: "update_in_progress" }), {
      status: 409,
    });
  }

  if (parsed.kind === "ignored") {
    await idempotency.completeUpdate(
      parsed.update.update_id,
      claimIdentity.owner,
    );
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
    });
  }

  const telegramId = extractTelegramId(parsed.update);
  const chatId = extractChatId(parsed.update);
  if (!telegramId || !chatId) {
    await idempotency.releaseUpdate(
      parsed.update.update_id,
      claimIdentity.owner,
    );
    return new Response(JSON.stringify({ error: "missing_actor" }), {
      status: 400,
    });
  }

  const telegram = createTelegramClient(readAuditorBotToken());

  try {
    const profile = await resolveProfileByTelegramId(admin, telegramId);
    const access = resolveAuditorAccess(profile);
    if (!access.allowed) {
      await handleUnauthorized({ telegram }, chatId);
      await idempotency.completeUpdate(
        parsed.update.update_id,
        claimIdentity.owner,
      );
      return new Response(JSON.stringify({ ok: true, denied: true }), {
        status: 200,
      });
    }

    const sessions = createSessionStore(admin);
    const places = createPlacesStore(admin);
    const storage = createStorageClient(admin);
    let session = bootstrapSession(telegramId, await sessions.get(telegramId));
    session.last_update_id = parsed.update.update_id;

    session = await handleAuthorizedUpdate(
      { places, sessions, storage, telegram },
      access.profile,
      parsed.update,
      session,
    );
    await sessions.upsert(session);
    await idempotency.completeUpdate(
      parsed.update.update_id,
      claimIdentity.owner,
    );
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error(
      "auditor_bot_error",
      error instanceof Error ? error.message : "unknown",
    );
    await idempotency.releaseUpdate(
      parsed.update.update_id,
      claimIdentity.owner,
    );
    try {
      await telegram.sendMessage({
        chat_id: chatId,
        text: "Внутренняя ошибка. Попробуйте /start позже.",
      });
    } catch {
      // transport failure should surface as 500 for Telegram retry
    }
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
    });
  }
}

if (import.meta.main) {
  Deno.serve(handleWebhookRequest);
}
