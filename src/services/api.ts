import { createClient } from "@supabase/supabase-js";
import type { AccessibilityStatus, Place, Profile } from "../types";
import { CATEGORIES, KARMA_LEVELS } from "../shared/index";

// Dynamic configuration via env variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Single Supabase client for the whole app. The session returned by
// auth-telegram is stored here (setSession), so every subsequent query runs as
// the authenticated user and RLS sees auth.uid(). persistSession +
// autoRefreshToken make the profile survive an app restart via the refresh
// token — that is the H0 acceptance gate.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "goapsny_auth",
  },
});

const categoryEmojis: Record<string, string> = {
  public_transport: "🚉",
  food: "☕",
  leisure: "🎭",
  bank_post: "🏦",
  shops: "🛒",
  education: "🎓",
  sport: "⚽",
  tourism: "🗺️",
  accommodation: "🏨",
  government: "🏛️",
  health: "🏥",
  other: "📍"
};

// 12 Wheelmap Categories from shared contract
export const categoriesList = CATEGORIES.map(c => ({
  slug: c.slug,
  name: c.ru,
  icon: categoryEmojis[c.slug] || "📍"
}));

// Translate karma slug to Russian using the shared ladder (must match backend).
export function translateKarmaStatus(slug: string): string {
  const level = KARMA_LEVELS.find(l => l.slug === slug);
  return level ? level.ru : slug;
}

// Explicit column list: avoids pulling the PostGIS `location` column and keeps
// the snake_case -> camelCase mapping total.
const PLACE_COLUMNS =
  "id, name, category, lat, lng, status, steps_count, step_height_cm, ramp_type, door_width_cm, entrance_notes, toilet_exists, toilet_accessible, parking, comment, osm_tags, moderation_status, source, created_by, created_at, updated_at";

function mapPlaceRow(item: Record<string, any>): Place {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    lat: item.lat,
    lng: item.lng,
    status: item.status,
    stepsCount: item.steps_count,
    stepHeightCm: item.step_height_cm,
    rampType: item.ramp_type,
    doorWidthCm: item.door_width_cm,
    entranceNotes: item.entrance_notes,
    toiletExists: item.toilet_exists,
    toiletAccessible: item.toilet_accessible,
    parking: item.parking,
    comment: item.comment,
    osmTags: item.osm_tags || {},
    moderationStatus: item.moderation_status,
    source: item.source,
    createdBy: item.created_by,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

function mapProfileRow(p: Record<string, any>): Profile {
  return {
    id: p.id,
    telegramId: p.telegram_id,
    username: p.username,
    displayName: p.display_name,
    role: p.role,
    aiEnabled: p.ai_enabled,
    karma: p.karma,
    karmaStatus: translateKarmaStatus(p.karma_status),
    createdAt: p.created_at
  };
}

export const api = {
  // 1. Telegram login -> real Supabase session.
  // auth-telegram validates initData and returns { access_token, refresh_token,
  // expires_at, profile }. We install that session so the user is authenticated
  // for all later queries. No mock, no fallback: on failure we throw.
  async loginTelegram(initData: string): Promise<{ profile: Profile }> {
    const { data, error } = await supabase.functions.invoke("auth-telegram", {
      body: { initData }
    });
    if (error) throw error;
    if (!data?.access_token || !data?.refresh_token) {
      throw new Error("auth-telegram returned no session");
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token
    });
    if (sessionError) throw sessionError;

    return { profile: mapProfileRow(data.profile) };
  },

  // 2. Published places, read under the user session so RLS applies.
  async getPlaces(): Promise<Place[]> {
    const { data, error } = await supabase
      .from("places")
      .select(PLACE_COLUMNS)
      .eq("moderation_status", "published")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapPlaceRow);
  },

  // 3. Create a place under the user session.
  // created_by MUST equal auth.uid() (RLS places_insert_collectors). No photo in
  // H0. osm_tags is computed by a DB trigger, so we don't send it.
  async createPlace(placeData: Partial<Place>): Promise<Place> {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) throw new Error("not_authenticated");

    const insert = {
      name: placeData.name,
      category: placeData.category,
      lat: placeData.lat,
      lng: placeData.lng,
      status: placeData.status,
      steps_count: placeData.stepsCount ?? null,
      step_height_cm: placeData.stepHeightCm ?? null,
      ramp_type: placeData.rampType ?? "none",
      door_width_cm: placeData.doorWidthCm ?? null,
      entrance_notes: placeData.entranceNotes ?? null,
      toilet_exists: placeData.toiletExists ?? "unknown",
      toilet_accessible: placeData.toiletAccessible ?? "unknown",
      parking: placeData.parking ?? "unknown",
      comment: placeData.comment ?? null,
      moderation_status: "published",
      source: "operator",
      created_by: uid
    };

    const { data, error } = await supabase
      .from("places")
      .insert(insert)
      .select(PLACE_COLUMNS)
      .single();
    if (error) throw error;
    return mapPlaceRow(data);
  },

  // 4. AI autofill — frozen for H0 (no photo flow). Kept for H1 as an honest
  // live call (no mock); ai-autofill requires the user session (verify_jwt).
  async getAiAutofill(photoPath: string): Promise<{
    name: string;
    category: string;
    stepsCount: number | null;
    rampType: "none" | "permanent" | "portable_on_request" | "portable_available";
    status: AccessibilityStatus | "";
  }> {
    const { data, error } = await supabase.functions.invoke("ai-autofill", {
      body: { photo_path: photoPath }
    });
    if (error) throw error;
    const draft = data?.draft ?? {};
    return {
      name: draft.name || "",
      category: draft.category || "other",
      stepsCount: draft.steps_visible ?? null,
      rampType: draft.ramp_visible ? "portable_available" : "none",
      status: draft.entrance_level === "level" ? "green" : "yellow"
    };
  }
};
