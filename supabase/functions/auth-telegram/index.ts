import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

const encoder = new TextEncoder();

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function hmacSha256(key: string | Uint8Array, message: string) {
  const keyBytes = typeof key === "string" ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(keyBytes).buffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message)));
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function validateTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userRaw = params.get("user");
  if (!receivedHash || !authDate || !userRaw) throw new Error("invalid_init_data");

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - authDate) > 300) throw new Error("expired_init_data");

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = await hmacSha256("WebAppData", botToken);
  const calculatedHash = toHex(await hmacSha256(secretKey, dataCheckString));
  if (!timingSafeEqual(calculatedHash, receivedHash)) throw new Error("bad_signature");

  return JSON.parse(userRaw) as TelegramUser;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const { initData } = await req.json();
    if (typeof initData !== "string" || initData.length === 0) {
      return jsonResponse({ error: "initData_required" }, 400);
    }

    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const user = await validateTelegramInitData(initData, env("TELEGRAM_BOT_TOKEN"));
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.username ||
      `Telegram ${user.id}`;
    const syntheticEmail = `tg_${user.id}@telegram.goapsny.local`;

    const { data: existingProfile, error: lookupError } = await admin
      .from("profiles")
      .select("id, role, trust_level, ai_enabled, karma, karma_status")
      .eq("telegram_id", user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    let authUserId = existingProfile?.id as string | undefined;
    if (!authUserId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: {
          provider: "telegram",
          telegram_id: user.id,
          username: user.username ?? null,
          display_name: displayName,
        },
      });
      if (createError || !created.user) throw createError ?? new Error("auth_user_not_created");
      authUserId = created.user.id;
    }

    const { data: profile, error: upsertError } = await admin
      .from("profiles")
      .upsert({
        id: authUserId,
        telegram_id: user.id,
        username: user.username ?? null,
        display_name: displayName,
        role: existingProfile?.role ?? "tester",
        trust_level: existingProfile?.trust_level ?? 1,
        ai_enabled: existingProfile?.ai_enabled ?? true,
        karma: existingProfile?.karma ?? 0,
        karma_status: existingProfile?.karma_status ?? "pedestrian",
      }, { onConflict: "id" })
      .select("id, telegram_id, username, display_name, role, trust_level, ai_enabled, karma, karma_status")
      .single();
    if (upsertError) throw upsertError;

    // Mint a genuine Supabase session for the (already created) auth user via
    // generateLink(magiclink) -> verifyOtp, instead of hand-signing a JWT.
    // A hand-signed HS256 token is rejected under asymmetric JWT signing keys
    // and carries no refresh token. verifyOtp must run on a non-admin (anon)
    // client so the returned session belongs to the user, not the service role.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      throw linkError ?? new Error("magiclink_not_generated");
    }

    const anon = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false },
    });
    const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    const session = verified?.session;
    if (verifyError || !session) {
      throw verifyError ?? new Error("session_not_created");
    }

    return jsonResponse({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      profile,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "auth_failed" }, 401);
  }
});
