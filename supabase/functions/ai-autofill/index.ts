import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type AutofillDraft = {
  name: string | null;
  category: string | null;
  steps_visible: number | null;
  ramp_visible: boolean | null;
  entrance_level: "level" | "steps" | null;
  ramp_type: "none" | "permanent" | "portable_on_request" | "portable_available" | null;
  status: "green" | "yellow" | "red" | null;
};

const budgetLimitUsd = Number(Deno.env.get("AI_MONTHLY_BUDGET_USD") ?? "50");
const estimatedCostUsd = Number(Deno.env.get("OPENAI_ESTIMATED_COST_USD") ?? "0.0020");
const model = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-4o-mini";

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function normalizeDraft(draft: Partial<AutofillDraft>): AutofillDraft {
  const rampTypes = ["none", "permanent", "portable_on_request", "portable_available"];
  const entranceLevels = ["level", "steps"];
  return {
    name: typeof draft.name === "string" && draft.name.trim() ? draft.name.trim() : null,
    category: typeof draft.category === "string" && draft.category.trim() ? draft.category.trim() : null,
    steps_visible: Number.isInteger(draft.steps_visible) ? Number(draft.steps_visible) : null,
    ramp_visible: typeof draft.ramp_visible === "boolean" ? draft.ramp_visible : null,
    entrance_level: entranceLevels.includes(String(draft.entrance_level))
      ? draft.entrance_level as AutofillDraft["entrance_level"]
      : null,
    ramp_type: rampTypes.includes(String(draft.ramp_type))
      ? draft.ramp_type as AutofillDraft["ramp_type"]
      : null,
    status: draft.status === "green" || draft.status === "yellow" || draft.status === "red"
      ? draft.status
      : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return jsonResponse({ error: "authorization_required" }, 401);

    const userClient = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "invalid_session" }, 401);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, role, ai_enabled")
      .eq("id", userData.user.id)
      .single();
    if (profileError || !profile) return jsonResponse({ error: "profile_not_found" }, 403);
    if (!profile.ai_enabled || !["owner", "admin", "operator", "tester"].includes(profile.role)) {
      await admin.from("ai_jobs").insert({
        user_id: userData.user.id,
        status: "error",
        model,
        error_text: "ai_not_enabled",
      });
      return jsonResponse({ status: "error", error: "ai_not_enabled" }, 403);
    }

    const { place_id: placeId = null, photo_path: photoPath } = await req.json();
    if (typeof photoPath !== "string" || photoPath.length === 0) {
      return jsonResponse({ error: "photo_path_required" }, 400);
    }

    const { data: monthlyRows, error: budgetError } = await admin
      .from("ai_jobs")
      .select("cost_usd")
      .gte("created_at", monthStartIso());
    if (budgetError) throw budgetError;
    const spent = (monthlyRows ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
    if (spent + estimatedCostUsd > budgetLimitUsd) {
      await admin.from("ai_jobs").insert({
        place_id: placeId,
        user_id: userData.user.id,
        photo_path: photoPath,
        model,
        cost_usd: 0,
        status: "blocked_budget",
        request: { monthly_spent_usd: spent, budget_limit_usd: budgetLimitUsd },
      });
      return jsonResponse({ status: "blocked_budget", draft: null });
    }

    const { data: signedPhoto, error: signedPhotoError } = await admin.storage
      .from("place-photos")
      .createSignedUrl(photoPath, 300);
    if (signedPhotoError || !signedPhoto?.signedUrl) {
      throw signedPhotoError ?? new Error("signed_photo_failed");
    }

    const prompt = [
      "На фото фасад или вход заведения в городе. Верни только JSON без markdown.",
      "Поля: name, category, steps_visible, ramp_visible, entrance_level, ramp_type, status.",
      "category: public_transport, food, leisure, bank_post, shops, education, sport, tourism, accommodation, government, health, other.",
      "status: green, yellow, red или null. Не выдумывай: если не видно, ставь null.",
    ].join(" ");
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: signedPhoto.signedUrl, detail: "low" } },
          ],
        }],
      }),
    });
    const raw = await openaiResponse.json();
    const content = raw?.choices?.[0]?.message?.content;
    if (!openaiResponse.ok || typeof content !== "string") {
      await admin.from("ai_jobs").insert({
        place_id: placeId,
        user_id: userData.user.id,
        photo_path: photoPath,
        model,
        cost_usd: 0,
        status: "error",
        request: { prompt },
        response: raw,
        error_text: "vision_call_failed",
      });
      return jsonResponse({ status: "error", error: "vision_call_failed" }, 502);
    }

    const draft = normalizeDraft(JSON.parse(content));
    await admin.from("ai_jobs").insert({
      place_id: placeId,
      user_id: userData.user.id,
      photo_path: photoPath,
      model,
      cost_usd: estimatedCostUsd,
      status: "ok",
      request: { prompt },
      response: { raw, draft },
    });
    return jsonResponse({ status: "ok", draft });
  } catch (error) {
    console.error(error);
    return jsonResponse({ status: "error", error: error instanceof Error ? error.message : "autofill_failed" }, 500);
  }
});
