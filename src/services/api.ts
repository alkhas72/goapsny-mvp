import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Place, Profile } from "../types";
import { CATEGORIES, CATEGORY_SLUGS, KARMA_LEVELS } from "../shared/index";
import { fetchPublishedPlaces, type PublicPlace } from "./places";
import { isSupabaseConfigured } from "./supabase";

// Dynamic configuration via env variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/**
 * Telegram-контур работает только против живого Supabase (DG-3 = (а)):
 * mock-слой, localStorage-источники и тихие фолбэки удалены. Любой отказ
 * сервера пробрасывается вызывающему коду как Error — UI обязан показать
 * его пользователю, а не выдать за успех.
 */

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

// ---- Telegram-сессия ----
//
// auth-telegram выпускает JWT, подписанный секретом проекта (а не сессию
// GoTrue с refresh-токеном), поэтому supabase-js получает его через опцию
// accessToken: все REST/Storage/Functions-запросы контура идут с этим
// Bearer-токеном, и RLS видит реального пользователя.

let sessionToken: string | null = null;
let sessionProfile: Profile | null = null;
let sessionClient: SupabaseClient | null = null;

function requireConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase не настроен: задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY");
  }
}

function getSessionClient(): SupabaseClient {
  requireConfigured();
  if (!sessionToken || !sessionProfile) {
    throw new Error("Нет активной сессии: требуется вход через Telegram");
  }
  if (!sessionClient) {
    const token = sessionToken;
    sessionClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      accessToken: () => Promise.resolve(token)
    });
  }
  return sessionClient;
}

// Helper to translate karma slug to Russian
function translateKarmaStatus(slug: string): string {
  const level = KARMA_LEVELS.find(l => l.slug === slug);
  return level ? level.ru : slug;
}

interface ProfileRow {
  id: string;
  telegram_id: number | null;
  username: string | null;
  display_name: string | null;
  role: Profile["role"];
  ai_enabled: boolean;
  karma: number;
  karma_status: string;
  created_at?: string;
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    telegramId: row.telegram_id ?? null,
    username: row.username ?? null,
    displayName: row.display_name ?? null,
    role: row.role,
    aiEnabled: row.ai_enabled ?? true,
    karma: row.karma ?? 0,
    karmaStatus: translateKarmaStatus(row.karma_status ?? "pedestrian"),
    createdAt: row.created_at ?? ""
  };
}

function toPlace(p: PublicPlace): Place {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    status: p.status,
    stepsCount: p.stepsCount,
    stepHeightCm: p.stepHeightCm,
    rampType: p.rampType,
    doorWidthCm: p.doorWidthCm,
    entranceNotes: p.entranceNotes,
    toiletExists: p.toiletExists,
    toiletAccessible: p.toiletAccessible,
    parking: p.parking,
    comment: p.comment,
    osmTags: p.osmTags,
    moderationStatus: p.moderationStatus,
    source: p.source as Place["source"],
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    mainPhoto: p.facadePhotoUrl ?? undefined
  };
}

function serverMessage(prefix: string, raw: unknown): Error {
  const detail = raw && typeof raw === "object" && "message" in raw ? String((raw as { message: unknown }).message) : "";
  return new Error(detail ? `${prefix}: ${detail}` : prefix);
}

export const api = {
  // 1. loginTelegram — вход через Edge Function auth-telegram.
  // Отказ (плохая подпись, истёкший initData, сбой сети) — исключение,
  // а не молчаливый mock-вход.
  async loginTelegram(initData: string): Promise<{ token: string; profile: Profile }> {
    requireConfigured();

    let response: Response;
    try {
      response = await fetch(`${SUPABASE_URL}/functions/v1/auth-telegram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ initData })
      });
    } catch (e) {
      throw serverMessage("Сервер авторизации недоступен", e);
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const reason = data && typeof data.error === "string" ? data.error : `HTTP ${response.status}`;
      throw new Error(`Вход через Telegram отклонён: ${reason}`);
    }
    if (!data?.access_token || !data?.profile) {
      throw new Error("Сервер авторизации вернул неполный ответ");
    }

    sessionToken = data.access_token as string;
    sessionProfile = mapProfile(data.profile);
    sessionClient = null; // пересоздастся с новым токеном при первом запросе
    return { token: sessionToken, profile: sessionProfile };
  },

  // Текущий профиль из базы (карма и статус обновляются серверными триггерами).
  async getProfile(): Promise<Profile> {
    const client = getSessionClient();
    const { data, error } = await client
      .from("profiles")
      .select("id, telegram_id, username, display_name, role, ai_enabled, karma, karma_status, created_at")
      .eq("id", sessionProfile!.id)
      .single();
    if (error) throw serverMessage("Не удалось прочитать профиль", error);
    sessionProfile = mapProfile(data);
    return sessionProfile;
  },

  // 2. getPlaces — единый с публичным контуром источник: опубликованные
  // места из Supabase (DG-3). Анонимного ключа достаточно — published читают все.
  async getPlaces(): Promise<Place[]> {
    const published = await fetchPublishedPlaces();
    return published.map(toPlace);
  },

  // 3. createPlace — путь картографа: фото в Storage, строка в places,
  // метаданные фото в photos. Карму начисляют серверные триггеры.
  // Любой сбой — исключение; частичные состояния честно описаны в сообщении.
  async createPlace(placeData: Partial<Place>, photoFile?: File): Promise<Place> {
    const client = getSessionClient();
    const placeId = crypto.randomUUID();
    const storagePath = `${placeId}/facade.jpg`;

    // 1) Фото фасада (файл уже приведён к JPEG клиентом — см. utils/photo.ts).
    let photoUploaded = false;
    if (photoFile) {
      const { error: uploadError } = await client.storage
        .from("place-photos")
        .upload(storagePath, photoFile, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw serverMessage("Не удалось загрузить фото", uploadError);
      photoUploaded = true;
    }

    // 2) Строка места. osm_tags строит серверный триггер; RLS требует
    // created_by = auth.uid(), роль коллектора и moderation_status = published.
    const { data: item, error: insertError } = await client
      .from("places")
      .insert({
        id: placeId,
        name: placeData.name,
        category: placeData.category,
        lat: placeData.lat,
        lng: placeData.lng,
        status: placeData.status,
        steps_count: placeData.stepsCount ?? null,
        step_height_cm: placeData.stepHeightCm ?? null,
        ramp_type: placeData.rampType ?? "none",
        door_width_cm: placeData.doorWidthCm ?? null,
        entrance_notes: placeData.entranceNotes || null,
        toilet_exists: placeData.toiletExists ?? "unknown",
        toilet_accessible: placeData.toiletAccessible ?? "unknown",
        parking: placeData.parking ?? "unknown",
        comment: placeData.comment || null,
        moderation_status: "published",
        source: "operator",
        created_by: sessionProfile!.id
      })
      .select()
      .single();

    if (insertError) {
      if (photoUploaded) {
        // Удалять объекты может только admin (RLS) — у коллектора уборка
        // не пройдёт, но попытаться обязаны: осиротевший файл хуже ошибки.
        try {
          await client.storage.from("place-photos").remove([storagePath]);
        } catch {
          // Исходная ошибка важнее.
        }
      }
      throw serverMessage("Не удалось сохранить объект", insertError);
    }

    // 3) Метаданные фото. Место уже создано — отказ здесь не отменяет объект,
    // и сообщение обязано это сказать честно.
    if (photoUploaded) {
      const { error: photoError } = await client
        .from("photos")
        .insert({ place_id: placeId, storage_path: storagePath, kind: "facade", uploaded_by: sessionProfile!.id });
      if (photoError) {
        throw serverMessage(
          "Объект сохранён, но фото не привязалось к карточке",
          photoError
        );
      }
    }

    let mainPhoto: string | undefined;
    if (photoUploaded) {
      const { data: signed } = await client.storage
        .from("place-photos")
        .createSignedUrl(storagePath, 300);
      mainPhoto = signed?.signedUrl ?? undefined;
    }

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
      updatedAt: item.updated_at,
      mainPhoto
    };
  },

  // Удаление объекта — только для ролей owner/admin (RLS places_delete_admin).
  // Отказ сервера пробрасывается наверх, UI показывает его честно.
  async deletePlace(placeId: string): Promise<void> {
    const client = getSessionClient();
    const { error } = await client.from("places").delete().eq("id", placeId);
    if (error) throw serverMessage("Не удалось удалить объект", error);
  },

  // Смена статуса — admin или автор объекта (RLS places_update_admin_or_author).
  async updatePlaceStatus(placeId: string, status: Place["status"]): Promise<void> {
    const client = getSessionClient();
    const { error } = await client.from("places").update({ status }).eq("id", placeId);
    if (error) throw serverMessage("Не удалось изменить статус", error);
  },

  // 4. getAiAutofill — живой вызов ai-autofill. Фото сначала уходит в Storage
  // (функция работает по пути в бакете), ответ не подменяется заглушкой:
  // сбой или blocked_budget — исключение с честным текстом.
  async getAiAutofill(photoFile: File): Promise<{
    name: string;
    category: string;
    stepsCount: number | null;
    rampType: "none" | "permanent" | "portable_on_request" | "portable_available";
    status: "green" | "yellow" | "red" | "";
  }> {
    const client = getSessionClient();

    const draftId = crypto.randomUUID();
    const photoPath = `${draftId}/facade.jpg`;
    const { error: uploadError } = await client.storage
      .from("place-photos")
      .upload(photoPath, photoFile, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw serverMessage("Не удалось загрузить фото для распознавания", uploadError);

    const { data, error } = await client.functions.invoke("ai-autofill", {
      body: { photo_path: photoPath }
    });
    if (error) throw serverMessage("ИИ-автозаполнение недоступно", error);
    if (data?.status === "blocked_budget") {
      throw new Error("ИИ-автозаполнение исчерпало месячный бюджет");
    }
    if (data?.status !== "ok" || !data?.draft) {
      throw new Error("ИИ не смог распознать фото");
    }

    const draft = data.draft;
    return {
      name: draft.name || "",
      category: CATEGORY_SLUGS.includes(draft.category) ? draft.category : "",
      stepsCount: draft.steps_visible ?? null,
      rampType: draft.ramp_visible ? "portable_available" : "none",
      status: draft.entrance_level === "level" ? "green" : draft.entrance_level === "steps" ? "yellow" : ""
    };
  }
};
