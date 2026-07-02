#!/usr/bin/env node
/**
 * H0 read-path smoke test: authenticated user reads published places under RLS,
 * same contract as src/services/api.ts (PLACE_COLUMNS + parking).
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PARKING_VALUES = new Set(["yes", "no", "unknown"]);

const verdicts = [];

function record(name, pass, detail = "") {
  verdicts.push({ name, pass, detail });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name}${detail ? `: ${detail}` : ""}`);
}

function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env optional if vars are exported in the shell
  }
}

function readPlaceColumnsFromApi() {
  const apiSource = readFileSync(resolve(ROOT, "src/services/api.ts"), "utf8");
  const match = apiSource.match(
    /const PLACE_COLUMNS\s*=\s*\n?\s*"([^"]+)"/,
  );
  if (!match) {
    throw new Error("Could not parse PLACE_COLUMNS from src/services/api.ts");
  }
  return match[1];
}

function env(name, aliases = []) {
  for (const key of [name, ...aliases]) {
    const value = process.env[key];
    if (value) return value;
  }
  return "";
}

async function hmacSha256(key, message) {
  const keyBuf = typeof key === "string" ? Buffer.from(key, "utf8") : key;
  return createHmac("sha256", keyBuf).update(message, "utf8").digest();
}

function toHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

async function buildTelegramInitData(botToken, user) {
  const authDate = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams();
  params.set("user", JSON.stringify(user));
  params.set("auth_date", String(authDate));

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await hmacSha256("WebAppData", botToken);
  const hash = toHex(await hmacSha256(secretKey, dataCheckString));
  params.set("hash", hash);
  return params.toString();
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signSupabaseJwt(userId, jwtSecret, expiresInSec = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      aud: "authenticated",
      exp: now + expiresInSec,
      iat: now,
      iss: "supabase",
      sub: userId,
      role: "authenticated",
    }),
  );
  const data = `${header}.${payload}`;
  const signature = createHmac("sha256", jwtSecret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

async function authViaTelegram(supabaseUrl, anonKey, botToken, telegramUser) {
  const initData = await buildTelegramInitData(botToken, telegramUser);
  const response = await fetch(`${supabaseUrl}/functions/v1/auth-telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ initData }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `auth-telegram HTTP ${response.status}: ${body.error ?? JSON.stringify(body)}`,
    );
  }
  if (!body.access_token || !body.refresh_token) {
    throw new Error("auth-telegram returned no session tokens");
  }
  return body;
}

function makeClient(supabaseUrl, anonKey) {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function main() {
  console.log("=== GoApsny H0 smoke (read path) ===\n");
  loadDotEnv();

  const supabaseUrl = env("SUPABASE_URL", ["VITE_SUPABASE_URL"]);
  const anonKey = env("SUPABASE_ANON_KEY", ["VITE_SUPABASE_ANON_KEY"]);
  const botToken = env("TELEGRAM_BOT_TOKEN");
  const jwtSecret = env("SUPABASE_JWT_SECRET");
  const smokeUserId = env("SMOKE_AUTH_USER_ID");

  record(
    "env: SUPABASE_URL + anon key",
    Boolean(supabaseUrl && anonKey),
    supabaseUrl && anonKey ? supabaseUrl : "missing SUPABASE_URL or SUPABASE_ANON_KEY (.env)",
  );
  if (!supabaseUrl || !anonKey) {
    printSummary();
    process.exit(1);
  }

  let placeColumns;
  try {
    placeColumns = readPlaceColumnsFromApi();
    record(
      "contract: PLACE_COLUMNS parsed from api.ts",
      placeColumns.includes("parking"),
      placeColumns,
    );
  } catch (error) {
    record("contract: PLACE_COLUMNS parsed from api.ts", false, error.message);
    printSummary();
    process.exit(1);
  }

  const expectedColumns = placeColumns.split(",").map((c) => c.trim());
  if (!expectedColumns.includes("parking")) {
    record("contract: parking in PLACE_COLUMNS", false, placeColumns);
  }

  const telegramUser = {
    id: Number(env("SMOKE_TELEGRAM_USER_ID") || "215263723"),
    first_name: env("SMOKE_TELEGRAM_FIRST_NAME") || "Smoke",
    last_name: env("SMOKE_TELEGRAM_LAST_NAME") || "Test",
    username: env("SMOKE_TELEGRAM_USERNAME") || "goapsny_smoke",
    language_code: "ru",
  };

  let authMode = null;
  let sessionPayload = null;
  let authError = null;

  if (botToken) {
    try {
      sessionPayload = await authViaTelegram(
        supabaseUrl,
        anonKey,
        botToken,
        telegramUser,
      );
      authMode = "auth-telegram";
    } catch (error) {
      authError = error;
    }
  }

  if (!sessionPayload && jwtSecret && smokeUserId) {
    try {
      const accessToken = signSupabaseJwt(smokeUserId, jwtSecret);
      sessionPayload = { access_token: accessToken, refresh_token: null };
      authMode = "jwt-secret";
    } catch (error) {
      authError = error;
    }
  }

  record(
    "auth: session obtained (no service_role)",
    Boolean(sessionPayload),
    sessionPayload
      ? `mode=${authMode}`
      : authError?.message ??
          "need TELEGRAM_BOT_TOKEN (preferred) or SUPABASE_JWT_SECRET+SMOKE_AUTH_USER_ID",
  );

  if (!sessionPayload) {
    const envKeys = [];
    try {
      envKeys.push(
        ...readFileSync(resolve(ROOT, ".env"), "utf8")
          .split("\n")
          .map((l) => l.trim().split("=")[0])
          .filter(Boolean),
      );
    } catch {
      /* no .env */
    }
    console.log(
      "\nRoot cause: .env has no TELEGRAM_BOT_TOKEN / SUPABASE_JWT_SECRET — " +
        "RLS places_read_published requires role authenticated, anon key alone is not enough. " +
        `Present keys: ${envKeys.join(", ") || "(none)"}. ` +
        "Add TELEGRAM_BOT_TOKEN (same as Edge Function secret) to run the honest auth-telegram path.",
    );
    printSummary();
    process.exit(1);
  }

  const client = makeClient(supabaseUrl, anonKey);
  const { error: setSessionError } = await client.auth.setSession({
    access_token: sessionPayload.access_token,
    refresh_token: sessionPayload.refresh_token ?? "",
  });
  record(
    "auth: setSession",
    !setSessionError,
    setSessionError?.message ?? "",
  );
  if (setSessionError) {
    printSummary();
    process.exit(1);
  }

  const { data: liveSession, error: getSessionError } =
    await client.auth.getSession();
  record(
    "auth: getSession live",
    Boolean(liveSession.session?.access_token) && !getSessionError,
    getSessionError?.message ??
      (liveSession.session?.user?.id
        ? `uid=${liveSession.session.user.id}`
        : "no session"),
  );

  let refreshOk = false;
  let refreshDetail = "";
  if (sessionPayload.refresh_token) {
    const { data: refreshed, error: refreshError } =
      await client.auth.refreshSession();
    refreshOk = Boolean(refreshed.session?.access_token) && !refreshError;
    refreshDetail = refreshError?.message ?? "refresh_token rotated";
  } else {
    refreshDetail =
      "skipped: JWT path has no refresh_token (use TELEGRAM_BOT_TOKEN for full H0 gate)";
  }
  record("auth: refresh token works", refreshOk, refreshDetail);

  const restartClient = makeClient(supabaseUrl, anonKey);
  await restartClient.auth.setSession({
    access_token: sessionPayload.access_token,
    refresh_token: sessionPayload.refresh_token ?? "",
  });
  const { data: restartSession } = await restartClient.auth.getSession();
  record(
    "auth: session survives client restart (in-memory re-set)",
    Boolean(restartSession.session?.access_token),
    restartSession.session?.user?.id ?? "",
  );

  const queryClient = refreshOk ? client : restartClient;
  const { data: places, error: placesError } = await queryClient
    .from("places")
    .select(placeColumns)
    .eq("moderation_status", "published")
    .order("created_at", { ascending: false })
    .limit(50);

  record(
    "read: published places via RLS",
    !placesError,
    placesError?.message ?? `rows=${places?.length ?? 0}`,
  );

  if (placesError) {
    printSummary();
    process.exit(1);
  }

  const rows = places ?? [];
  const missingParking = rows.filter((row) => !("parking" in row));
  record(
    "read: parking column present on every row",
    missingParking.length === 0,
    missingParking.length
      ? `${missingParking.length} row(s) without parking`
      : rows.length
        ? `checked ${rows.length} row(s)`
        : "0 rows (empty table is OK for column check)",
  );

  const badParking = rows.filter(
    (row) => row.parking != null && !PARKING_VALUES.has(row.parking),
  );
  record(
    "read: parking values are yes|no|unknown",
    badParking.length === 0,
    badParking.length
      ? `invalid: ${badParking.map((r) => `${r.id}=${r.parking}`).join(", ")}`
      : rows.length
        ? `checked ${rows.length} row(s)`
        : "no rows to validate",
  );

  const sample = rows[0];
  if (sample) {
    const returnedKeys = Object.keys(sample).sort();
    const missingCols = expectedColumns.filter((c) => !(c in sample));
    record(
      "read: response keys match PLACE_COLUMNS",
      missingCols.length === 0,
      missingCols.length
        ? `missing: ${missingCols.join(", ")}`
        : `${returnedKeys.length} fields on sample id=${sample.id}`,
    );
  } else {
    record(
      "read: response keys match PLACE_COLUMNS",
      true,
      "skipped — no published places yet",
    );
  }

  console.log("\nRLS note: places_read_published allows SELECT for authenticated when moderation_status='published' (or own drafts / admin).");
  printSummary();
  const allPass = verdicts.every((v) => v.pass);
  process.exit(allPass ? 0 : 1);
}

function printSummary() {
  const passed = verdicts.filter((v) => v.pass).length;
  const failed = verdicts.length - passed;
  console.log(`\n=== SUMMARY: ${passed}/${verdicts.length} PASS, ${failed} FAIL ===`);
  if (failed > 0) {
    console.log("Failed checks:");
    for (const v of verdicts.filter((x) => !x.pass)) {
      console.log(`  - ${v.name}${v.detail ? `: ${v.detail}` : ""}`);
    }
  }
}

main().catch((error) => {
  console.error("\nUnhandled error:", error);
  process.exit(1);
});
