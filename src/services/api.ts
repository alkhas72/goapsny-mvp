import type { Place, Profile, AccessibilityStatus } from "../types";
import { CATEGORIES, KARMA_LEVELS, karmaLevelFor, karmaNext } from "/Users/alkhas.abaza/Documents/03-IDLAB/goapsny-shared/index";

// Dynamic configuration via env variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
// Keep mock as the working mode for now, even if env keys are present
const isLiveMode = false;

console.log(`[GoApsny API] Mode: ${isLiveMode ? "LIVE (Supabase)" : "MOCK (Local Storage)"}`);

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

// Initial mock places
const defaultMockPlaces: Place[] = [
  {
    id: "p1",
    name: "Абхазская государственная филармония",
    category: "leisure",
    lat: 43.00331,
    lng: 41.02365,
    status: "red",
    stepsCount: 8,
    stepHeightCm: 15,
    rampType: "none",
    doorWidthCm: 80,
    entranceNotes: "Высокое крыльцо, около 8 ступеней. Пандус на главном входе не обнаружен.",
    toiletExists: "yes",
    toiletAccessible: "unknown",
    parking: "unknown",
    comment: "Главный вход недоступен.",
    osmTags: { wheelchair: "no", "door:width": "0.8", step_count: "8" },
    moderationStatus: "published",
    source: "operator",
    createdBy: "u-operator",
    createdAt: "2026-05-30T10:00:00Z",
    updatedAt: "2026-05-30T10:00:00Z",
    mainPhoto: "https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=900&q=75"
  },
  {
    id: "p2",
    name: "Кафе у моря",
    category: "food",
    lat: 43.00085,
    lng: 41.0159,
    status: "yellow",
    stepsCount: 1,
    stepHeightCm: 10,
    rampType: "portable_available",
    doorWidthCm: 90,
    entranceNotes: "Вход с приставным пандусом по требованию.",
    toiletExists: "yes",
    toiletAccessible: "no",
    parking: "unknown",
    comment: "Персонал помогает вынести пандус. Внутри удобно, но туалет не адаптирован.",
    osmTags: { wheelchair: "limited", "ramp:portable": "yes" },
    moderationStatus: "published",
    source: "operator",
    createdBy: "u-operator",
    createdAt: "2026-05-31T12:00:00Z",
    updatedAt: "2026-05-31T12:00:00Z",
    mainPhoto: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=75"
  },
  {
    id: "p3",
    name: "Аптека на Леона",
    category: "health",
    lat: 43.0048,
    lng: 41.0302,
    status: "green",
    stepsCount: 0,
    stepHeightCm: 0,
    rampType: "permanent",
    doorWidthCm: 100,
    entranceNotes: "Абсолютно плоский вход вровень с тротуаром, широкая автоматическая дверь.",
    toiletExists: "no",
    toiletAccessible: "unknown",
    parking: "yes",
    comment: "Очень доступно.",
    osmTags: { wheelchair: "yes", step_count: "0" },
    moderationStatus: "published",
    source: "operator",
    createdBy: "u-admin",
    createdAt: "2026-06-01T08:00:00Z",
    updatedAt: "2026-06-01T08:00:00Z",
    mainPhoto: "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=900&q=75"
  }
];

// Helper to persist/load data from localStorage in mock mode
const getStoragePlaces = (): Place[] => {
  const data = localStorage.getItem("goapsny_places");
  if (!data) {
    localStorage.setItem("goapsny_places", JSON.stringify(defaultMockPlaces));
    return defaultMockPlaces;
  }
  return JSON.parse(data);
};

const saveStoragePlaces = (places: Place[]) => {
  localStorage.setItem("goapsny_places", JSON.stringify(places));
};

const getStorageProfile = (): Profile => {
  const defaultProfile: Profile = {
    id: "u-operator",
    telegramId: 215263723,
    username: "alkhas_abaza",
    displayName: "Алхас Тхагушев",
    role: "owner",
    aiEnabled: true,
    karma: 125,
    karmaStatus: "Картограф",
    createdAt: "2026-05-10T11:00:00Z"
  };
  const data = localStorage.getItem("goapsny_profile");
  if (!data) {
    localStorage.setItem("goapsny_profile", JSON.stringify(defaultProfile));
    return defaultProfile;
  }
  return JSON.parse(data);
};

const saveStorageProfile = (profile: Profile) => {
  localStorage.setItem("goapsny_profile", JSON.stringify(profile));
};

// Helper to translate karma slug to Russian
export function translateKarmaStatus(slug: string): string {
  const level = KARMA_LEVELS.find(l => l.slug === slug);
  return level ? level.ru : slug;
}

// Karma status scale helper (7 levels) using shared contract functions
export const getKarmaStatusAndNextLimit = (points: number): { status: string; nextLimit: number } => {
  const currentLevel = karmaLevelFor(points);
  const { next } = karmaNext(points);
  return {
    status: currentLevel.ru,
    nextLimit: next ? next.threshold : 99999
  };
};

// Real Live Supabase fetch helper (uses standard fetch wrapper to make calls to Edge Functions)
const supabaseRequest = async (endpoint: string, method: string = "POST", body?: any, token?: string) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} - ${text}`);
  }

  return response.json();
};

export const api = {
  // 1. loginTelegram
  async loginTelegram(initData: string): Promise<{ token: string; profile: Profile }> {
    if (!isLiveMode) {
      // Mock Login Delay
      await new Promise(resolve => setTimeout(resolve, 800));
      const profile = getStorageProfile();
      return { token: "mock_jwt_token", profile };
    }

    try {
      const data = await supabaseRequest("auth-telegram", "POST", { initData });
      return {
        token: data.access_token,
        profile: {
          id: data.profile.id,
          telegramId: data.profile.telegram_id,
          username: data.profile.username,
          displayName: data.profile.display_name,
          role: data.profile.role,
          aiEnabled: data.profile.ai_enabled,
          karma: data.profile.karma,
          karmaStatus: translateKarmaStatus(data.profile.karma_status),
          createdAt: data.profile.created_at
        }
      };
    } catch (e) {
      console.error("loginTelegram failed, using local profile fallback", e);
      const profile = getStorageProfile();
      return { token: "mock_jwt_token", profile };
    }
  },

  // 2. getPlaces
  async getPlaces(): Promise<Place[]> {
    if (!isLiveMode) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return getStoragePlaces();
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/places?select=*&moderation_status=eq.published`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (!response.ok) throw new Error("Fetch failed");
      const list = await response.json();
      return list.map((item: any) => ({
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
        mainPhoto: item.main_photo
      }));
    } catch (e) {
      console.error("getPlaces failed, falling back to local places", e);
      return getStoragePlaces();
    }
  },

  // 3. createPlace
  async createPlace(placeData: Partial<Place>, photoFile?: File): Promise<Place> {
    const profile = getStorageProfile();

    if (!isLiveMode) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const places = getStoragePlaces();
      
      let photoUrl = "https://images.unsplash.com/photo-1449824913935-59a10b8d2000f?auto=format&fit=crop&w=900&q=75";
      if (photoFile) {
        // Create local object URL for previewing the uploaded file in mock mode
        photoUrl = URL.createObjectURL(photoFile);
      }

      // OSM Mapping logic
      const osmTags: Record<string, string> = {
        wheelchair: placeData.status === "green" ? "yes" : placeData.status === "yellow" ? "limited" : "no",
        "door:width": placeData.doorWidthCm ? (placeData.doorWidthCm / 100).toString() : "",
        step_count: placeData.stepsCount?.toString() || ""
      };
      if (placeData.rampType === "permanent") {
        osmTags.ramp = "yes";
        osmTags["ramp:wheelchair"] = "yes";
      } else if (placeData.rampType && placeData.rampType !== "none") {
        osmTags["ramp:portable"] = "yes";
      }

      const newPlace: Place = {
        id: `p-${Date.now()}`,
        name: placeData.name || "Новый объект",
        category: placeData.category || "other",
        lat: placeData.lat || 43.0033,
        lng: placeData.lng || 41.0237,
        status: placeData.status as AccessibilityStatus || "green",
        stepsCount: placeData.stepsCount !== undefined ? Number(placeData.stepsCount) : null,
        stepHeightCm: placeData.stepHeightCm !== undefined ? Number(placeData.stepHeightCm) : null,
        rampType: placeData.rampType || "none",
        doorWidthCm: placeData.doorWidthCm !== undefined ? Number(placeData.doorWidthCm) : null,
        entranceNotes: placeData.entranceNotes || "",
        toiletExists: placeData.toiletExists || "unknown",
        toiletAccessible: placeData.toiletAccessible || "unknown",
        parking: placeData.parking || "unknown",
        comment: placeData.comment || "",
        osmTags,
        moderationStatus: "published", // Operators publish instantly
        source: "operator",
        createdBy: profile.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mainPhoto: photoUrl
      };

      // Add to mock lists
      places.unshift(newPlace);
      saveStoragePlaces(places);

      // Increase user Karma! +10 for POI, +5 if photo was added, +10 for full card bonus
      let karmaBonus = 10;
      if (photoFile) {
        karmaBonus += 5;
      }
      const hasEntranceInfo = newPlace.stepsCount !== null || newPlace.rampType !== "none";
      const hasToiletInfo = newPlace.toiletExists !== "unknown";
      if (newPlace.name && newPlace.category && hasEntranceInfo && hasToiletInfo && newPlace.comment) {
        karmaBonus += 10;
      }

      profile.karma += karmaBonus;
      const { status } = getKarmaStatusAndNextLimit(profile.karma);
      profile.karmaStatus = status;
      saveStorageProfile(profile);

      return newPlace;
    }

    try {
      // In live mode, we'd upload the photo to storage first
      let photoUrl = "";
      
      const placeId = crypto.randomUUID();

      if (photoFile) {
        const fileExt = photoFile.name.split(".").pop();
        const path = `place-photos/${placeId}/facade.${fileExt}`;
        
        // Upload photo via REST API
        const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/place-photos/${path}`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": photoFile.type
          },
          body: photoFile
        });
        
        if (uploadResponse.ok) {
          photoUrl = `${SUPABASE_URL}/storage/v1/object/public/place-photos/${path}`;
        }
      }

      // OSM Mapping logic
      const osmTags: Record<string, string> = {
        wheelchair: placeData.status === "green" ? "yes" : placeData.status === "yellow" ? "limited" : "no",
        "door:width": placeData.doorWidthCm ? (placeData.doorWidthCm / 100).toString() : "",
        step_count: placeData.stepsCount?.toString() || ""
      };
      if (placeData.rampType === "permanent") {
        osmTags.ramp = "yes";
        osmTags["ramp:wheelchair"] = "yes";
      } else if (placeData.rampType && placeData.rampType !== "none") {
        osmTags["ramp:portable"] = "yes";
      }

      const body = {
        id: placeId,
        name: placeData.name,
        category: placeData.category,
        lat: placeData.lat,
        lng: placeData.lng,
        status: placeData.status,
        steps_count: placeData.stepsCount,
        step_height_cm: placeData.stepHeightCm,
        ramp_type: placeData.rampType,
        door_width_cm: placeData.doorWidthCm,
        entrance_notes: placeData.entranceNotes,
        toilet_exists: placeData.toiletExists,
        toilet_accessible: placeData.toiletAccessible,
        parking: placeData.parking,
        comment: placeData.comment,
        osm_tags: osmTags,
        moderation_status: "published",
        source: "operator",
        main_photo: photoUrl,
        created_by: profile.id
      };

      const response = await fetch(`${SUPABASE_URL}/rest/v1/places`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error("Failed to insert place record");
      }

      const result = await response.json();
      const item = result[0];

      // Local client karma calculations removed in live mode (managed by database triggers)

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
        mainPhoto: item.main_photo
      };
    } catch (e) {
      console.error("createPlace live failed, falling back to mock save", e);
      return this.createPlace(placeData, photoFile);
    }
  },

  // 4. getAiAutofill
  async getAiAutofill(photoPath: string): Promise<{
    name: string;
    category: string;
    stepsCount: number | null;
    rampType: "none" | "permanent" | "portable_on_request" | "portable_available";
    status: AccessibilityStatus | "";
  }> {
    if (!isLiveMode) {
      // Mock Vision Delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Return plausible AI autofill values
      return {
        name: "Сухумский Государственный Колледж",
        category: "education",
        stepsCount: 3,
        rampType: "portable_available",
        status: "yellow"
      };
    }

    try {
      const data = await supabaseRequest("ai-autofill", "POST", { photo_path: photoPath });
      return {
        name: data.draft.name || "",
        category: data.draft.category || "other",
        stepsCount: data.draft.steps_visible !== undefined ? data.draft.steps_visible : null,
        rampType: data.draft.ramp_visible ? "portable_available" : "none",
        status: data.draft.entrance_level === "level" ? "green" : "yellow"
      };
    } catch (e) {
      console.error("getAiAutofill failed, falling back to mock data", e);
      return {
        name: "Абхазский Национальный Музей",
        category: "leisure",
        stepsCount: 5,
        rampType: "none",
        status: "red"
      };
    }
  }
};
