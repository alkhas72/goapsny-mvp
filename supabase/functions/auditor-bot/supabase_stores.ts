import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "./constants.ts";
import {
  defaultAuditFields,
  isFinalStatus,
  mergeVerificationDetails,
} from "./validation.ts";
import type { IdempotencyStore } from "./idempotency.ts";
import type { PlacesStore } from "./places.ts";
import type { SessionStore } from "./session.ts";
import type { StorageClient } from "./places.ts";
import type {
  AuditFields,
  BotSession,
  PhotoRow,
  PlaceRow,
  Profile,
} from "./types.ts";

export function createSessionStore(admin: SupabaseClient): SessionStore {
  return {
    async get(telegramId) {
      const { data, error } = await admin
        .from("auditor_bot_sessions")
        .select("telegram_id, state, draft, last_update_id, updated_at")
        .eq("telegram_id", telegramId)
        .maybeSingle();
      if (error) throw error;
      return data as BotSession | null;
    },
    async upsert(session) {
      const { error } = await admin.from("auditor_bot_sessions").upsert({
        telegram_id: session.telegram_id,
        state: session.state,
        draft: session.draft,
        last_update_id: session.last_update_id,
      });
      if (error) throw error;
    },
    async clear(telegramId) {
      const { error } = await admin.from("auditor_bot_sessions").delete().eq(
        "telegram_id",
        telegramId,
      );
      if (error) throw error;
    },
  };
}

export function createIdempotencyStore(
  admin: SupabaseClient,
): IdempotencyStore {
  return {
    async claimUpdate(updateId) {
      const { error } = await admin.from("auditor_bot_processed_updates")
        .insert({
          update_id: updateId,
          status: "processing",
        });
      if (!error) return "claimed";
      if (error.code !== "23505") throw error;

      const { data, error: lookupError } = await admin
        .from("auditor_bot_processed_updates")
        .select("status")
        .eq("update_id", updateId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (data?.status === "completed") return "completed";
      return "processing";
    },
    async completeUpdate(updateId) {
      const { error } = await admin
        .from("auditor_bot_processed_updates")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("update_id", updateId);
      if (error) throw error;
    },
    async releaseUpdate(updateId) {
      const { error } = await admin
        .from("auditor_bot_processed_updates")
        .delete()
        .eq("update_id", updateId)
        .eq("status", "processing");
      if (error) throw error;
    },
  };
}

export function createPlacesStore(admin: SupabaseClient): PlacesStore {
  return {
    async listGrayPublished(offset, limit) {
      const { data, error } = await admin
        .from("places")
        .select(
          "id, name, category, lat, lng, status, moderation_status, source, created_by, details, steps_count, step_height_cm, ramp_type, door_width_cm, entrance_notes, toilet_exists, toilet_accessible, parking, comment",
        )
        .eq("status", "gray")
        .eq("moderation_status", "published")
        .order("created_at", { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []) as PlaceRow[];
    },
    async listVerifiedPublished(offset, limit) {
      const { data, error } = await admin
        .from("places")
        .select(
          "id, name, category, lat, lng, status, moderation_status, source, created_by, details, steps_count, step_height_cm, ramp_type, door_width_cm, entrance_notes, toilet_exists, toilet_accessible, parking, comment",
        )
        .in("status", ["green", "yellow", "red"])
        .eq("moderation_status", "published")
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []) as PlaceRow[];
    },
    async getPlace(id) {
      const { data, error } = await admin
        .from("places")
        .select(
          "id, name, category, lat, lng, status, moderation_status, source, created_by, details, steps_count, step_height_cm, ramp_type, door_width_cm, entrance_notes, toilet_exists, toilet_accessible, parking, comment",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as PlaceRow | null;
    },
    async getFacadePhoto(placeId) {
      const { data, error } = await admin
        .from("photos")
        .select("id, place_id, storage_path, kind, uploaded_by")
        .eq("place_id", placeId)
        .eq("kind", "facade")
        .maybeSingle();
      if (error) throw error;
      return data as PhotoRow | null;
    },
    async verifyGrayPlace(input) {
      const existing = await this.getPlace(input.placeId);
      if (!existing) return { ok: false, reason: "not_found" };
      if (existing.moderation_status === "hidden") {
        return { ok: false, reason: "hidden" };
      }
      if (
        existing.status !== "gray" || existing.moderation_status !== "published"
      ) {
        return { ok: false, reason: "stale" };
      }

      const details = mergeVerificationDetails(existing.details, {
        address: input.address,
        elevator: input.elevator,
        verifiedAt: input.verifiedAt,
      });

      const { data, error } = await admin
        .from("places")
        .update({
          status: input.status,
          steps_count: input.audit.steps_count,
          step_height_cm: input.audit.step_height_cm,
          ramp_type: input.audit.ramp_type,
          door_width_cm: input.audit.door_width_cm,
          entrance_notes: input.audit.entrance_notes,
          toilet_exists: input.audit.toilet_exists,
          toilet_accessible: input.audit.toilet_accessible,
          parking: input.audit.parking,
          comment: input.audit.comment,
          details,
        })
        .eq("id", input.placeId)
        .eq("status", "gray")
        .eq("moderation_status", "published")
        .select(
          "id, name, category, lat, lng, status, moderation_status, source, created_by, details, steps_count, step_height_cm, ramp_type, door_width_cm, entrance_notes, toilet_exists, toilet_accessible, parking, comment",
        )
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ok: false, reason: "stale" };
      return { ok: true, place: data as PlaceRow };
    },
    async publishVerifiedPlace(input) {
      if (!isFinalStatus(input.status)) {
        return { ok: false, reason: "invalid_status" };
      }
      const details = mergeVerificationDetails({ schema_version: 1 }, {
        address: input.address,
        elevator: input.elevator,
        verifiedAt: input.verifiedAt,
      });
      const storagePath = `${input.placeId}/facade.jpg`;

      const { error } = await admin.rpc("auditor_publish_verified_place", {
        p_place_id: input.placeId,
        p_name: input.name,
        p_category: input.category,
        p_lat: input.lat,
        p_lng: input.lng,
        p_status: input.status,
        p_steps_count: input.audit.steps_count,
        p_step_height_cm: input.audit.step_height_cm,
        p_ramp_type: input.audit.ramp_type,
        p_door_width_cm: input.audit.door_width_cm,
        p_entrance_notes: input.audit.entrance_notes,
        p_toilet_exists: input.audit.toilet_exists,
        p_toilet_accessible: input.audit.toilet_accessible,
        p_parking: input.audit.parking,
        p_comment: input.audit.comment,
        p_details: details,
        p_created_by: input.profile.id,
        p_storage_path: storagePath,
        p_uploaded_by: input.facadeUploadedBy,
      });
      if (error) return { ok: false, reason: error.message };

      const place = await this.getPlace(input.placeId);
      if (!place) return { ok: false, reason: "publish_failed" };
      return { ok: true, place };
    },
    async editVerifiedPlace(input) {
      if (!isFinalStatus(input.status)) {
        return { ok: false, reason: "invalid_status" };
      }
      if (input.preserve.moderation_status === "hidden") {
        return { ok: false, reason: "hidden" };
      }

      const details = mergeVerificationDetails(input.preserve.details, {
        address: input.address,
        elevator: input.elevator,
        verifiedAt: input.verifiedAt,
      });

      const { data, error } = await admin
        .from("places")
        .update({
          status: input.status,
          steps_count: input.audit.steps_count,
          step_height_cm: input.audit.step_height_cm,
          ramp_type: input.audit.ramp_type,
          door_width_cm: input.audit.door_width_cm,
          entrance_notes: input.audit.entrance_notes,
          toilet_exists: input.audit.toilet_exists,
          toilet_accessible: input.audit.toilet_accessible,
          parking: input.audit.parking,
          comment: input.audit.comment,
          details,
        })
        .eq("id", input.placeId)
        .in("status", ["green", "yellow", "red"])
        .eq("moderation_status", "published")
        .select(
          "id, name, category, lat, lng, status, moderation_status, source, created_by, details, steps_count, step_height_cm, ramp_type, door_width_cm, entrance_notes, toilet_exists, toilet_accessible, parking, comment",
        )
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ok: false, reason: "stale" };
      return { ok: true, place: data as PlaceRow };
    },
    async deletePlace(placeId) {
      const { error } = await admin.from("places").delete().eq("id", placeId);
      if (error) throw error;
    },
  };
}

export function createStorageClient(admin: SupabaseClient): StorageClient {
  return {
    async uploadFacade(placeId, bytes) {
      const path = `${placeId}/facade.jpg`;
      const { error } = await admin.storage.from(PHOTO_BUCKET).upload(
        path,
        bytes,
        {
          contentType: "image/jpeg",
          upsert: true,
        },
      );
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    },
    async removeFacade(placeId) {
      await admin.storage.from(PHOTO_BUCKET).remove([`${placeId}/facade.jpg`]);
    },
    async getFacadeSignedUrl(storagePath) {
      const { data, error } = await admin.storage.from(PHOTO_BUCKET)
        .createSignedUrl(storagePath, 300);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
  };
}

export async function resolveProfileByTelegramId(
  admin: SupabaseClient,
  telegramId: number,
): Promise<Profile | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, telegram_id, role, display_name")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as Profile;
}

export function emptyAuditFromPlace(place: PlaceRow): AuditFields {
  return {
    steps_count: place.steps_count,
    step_height_cm: place.step_height_cm,
    ramp_type: place.ramp_type,
    door_width_cm: place.door_width_cm,
    entrance_notes: place.entrance_notes,
    toilet_exists: place.toilet_exists,
    toilet_accessible: place.toilet_accessible,
    parking: place.parking,
    comment: place.comment,
  };
}

export function emptyAudit(): AuditFields {
  return defaultAuditFields();
}
