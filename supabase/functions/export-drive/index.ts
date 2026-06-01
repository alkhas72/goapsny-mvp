import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const exportSecret = Deno.env.get("EXPORT_JOB_SECRET");
  if (exportSecret && req.headers.get("x-export-secret") !== exportSecret) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  try {
    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const [profiles, places, photos, aiJobs, karmaEvents] = await Promise.all([
      admin.from("profiles").select("*"),
      admin.from("places").select("*"),
      admin.from("photos").select("*"),
      admin.from("ai_jobs").select("*"),
      admin.from("karma_events").select("*"),
    ]);
    const error = profiles.error || places.error || photos.error || aiJobs.error || karmaEvents.error;
    if (error) throw error;

    return jsonResponse({
      status: "ok",
      exported_at: new Date().toISOString(),
      note: "Drive upload waits for Google Drive service credentials. This is the day-4 export payload.",
      data: {
        profiles: profiles.data ?? [],
        places: places.data ?? [],
        photos: photos.data ?? [],
        ai_jobs: aiJobs.data ?? [],
        karma_events: karmaEvents.data ?? [],
      },
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ status: "error", error: error instanceof Error ? error.message : "export_failed" }, 500);
  }
});
