// deno-lint-ignore-file require-await
import { mergeVerificationDetails } from "./validation.ts";
import type {
  AuditFields,
  BotSession,
  PhotoRow,
  PlaceRow,
  Profile,
} from "./types.ts";
import type { IdempotencyStore } from "./idempotency.ts";
import type { PlacesStore, StorageClient } from "./places.ts";
import type { SessionStore } from "./session.ts";
import type { OutgoingMessage, TelegramClient } from "./types.ts";

export function makePlace(overrides: Partial<PlaceRow> = {}): PlaceRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "Тестовое место",
    category: overrides.category ?? "shops",
    lat: overrides.lat ?? 43.0,
    lng: overrides.lng ?? 41.0,
    status: overrides.status ?? "gray",
    steps_count: overrides.steps_count ?? null,
    step_height_cm: overrides.step_height_cm ?? null,
    ramp_type: overrides.ramp_type ?? "none",
    door_width_cm: overrides.door_width_cm ?? null,
    entrance_notes: overrides.entrance_notes ?? null,
    toilet_exists: overrides.toilet_exists ?? "unknown",
    toilet_accessible: overrides.toilet_accessible ?? "unknown",
    parking: overrides.parking ?? "unknown",
    comment: overrides.comment ?? null,
    details: overrides.details ?? { schema_version: 1 },
    moderation_status: overrides.moderation_status ?? "published",
    source: overrides.source ?? "public",
    created_by: overrides.created_by ?? crypto.randomUUID(),
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    telegram_id: overrides.telegram_id ?? 1001,
    role: overrides.role ?? "tester",
    display_name: overrides.display_name ?? "Аудитор",
  };
}

export class MemoryPlacesStore implements PlacesStore {
  places = new Map<string, PlaceRow>();
  photos = new Map<string, PhotoRow>();
  publishShouldFail = false;

  constructor(seed: PlaceRow[] = [], seedPhotos: PhotoRow[] = []) {
    for (const place of seed) this.places.set(place.id, structuredClone(place));
    for (const photo of seedPhotos) {
      this.photos.set(photo.id, structuredClone(photo));
    }
  }

  async listGrayPublished(offset: number, limit: number) {
    return [...this.places.values()]
      .filter((p) => p.status === "gray" && p.moderation_status === "published")
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .slice(offset, offset + limit);
  }

  async listVerifiedPublished(offset: number, limit: number) {
    return [...this.places.values()]
      .filter((p) =>
        ["green", "yellow", "red"].includes(p.status) &&
        p.moderation_status === "published"
      )
      .slice(offset, offset + limit);
  }

  async getPlace(id: string) {
    const place = this.places.get(id);
    return place ? structuredClone(place) : null;
  }

  async getFacadePhoto(placeId: string) {
    return [...this.photos.values()].find((p) =>
      p.place_id === placeId && p.kind === "facade"
    ) ?? null;
  }

  async verifyGrayPlace(
    input: Parameters<PlacesStore["verifyGrayPlace"]>[0],
  ) {
    const existing = this.places.get(input.placeId);
    if (!existing) return { ok: false as const, reason: "not_found" as const };
    if (existing.moderation_status === "hidden") {
      return { ok: false as const, reason: "hidden" as const };
    }
    if (
      existing.status !== "gray" || existing.moderation_status !== "published"
    ) {
      return { ok: false as const, reason: "stale" as const };
    }
    const updated: PlaceRow = {
      ...existing,
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
      details: mergeVerificationDetails(existing.details, {
        address: input.address,
        elevator: input.elevator,
        verifiedAt: input.verifiedAt,
      }),
    };
    this.places.set(input.placeId, updated);
    return { ok: true as const, place: structuredClone(updated) };
  }

  async publishVerifiedPlace(
    input: Parameters<PlacesStore["publishVerifiedPlace"]>[0],
  ) {
    if (this.publishShouldFail) {
      return { ok: false as const, reason: "photo_index_failed" };
    }
    const row: PlaceRow = {
      id: input.placeId,
      name: input.name,
      category: input.category,
      lat: input.lat,
      lng: input.lng,
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
      details: mergeVerificationDetails({ schema_version: 1 }, {
        address: input.address,
        elevator: input.elevator,
        verifiedAt: input.verifiedAt,
      }),
      moderation_status: "published",
      source: "operator",
      created_by: input.profile.id,
    };
    const photo: PhotoRow = {
      id: crypto.randomUUID(),
      place_id: input.placeId,
      storage_path: `${input.placeId}/facade.jpg`,
      kind: "facade",
      uploaded_by: input.facadeUploadedBy,
    };
    this.places.set(input.placeId, row);
    this.photos.set(photo.id, photo);
    return { ok: true as const, place: structuredClone(row) };
  }

  async editVerifiedPlace(
    input: Parameters<PlacesStore["editVerifiedPlace"]>[0],
  ) {
    const existing = this.places.get(input.placeId);
    if (!existing) return { ok: false as const, reason: "not_found" as const };
    if (existing.moderation_status === "hidden") {
      return { ok: false as const, reason: "hidden" as const };
    }
    if (
      !["green", "yellow", "red"].includes(existing.status) ||
      existing.moderation_status !== "published"
    ) {
      return { ok: false as const, reason: "stale" as const };
    }
    const updated: PlaceRow = {
      ...existing,
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
      details: mergeVerificationDetails(input.preserve.details, {
        address: input.address,
        elevator: input.elevator,
        verifiedAt: input.verifiedAt,
      }),
      source: input.preserve.source,
      created_by: input.preserve.created_by,
      moderation_status: input.preserve.moderation_status,
    };
    this.places.set(input.placeId, updated);
    return { ok: true as const, place: structuredClone(updated) };
  }

  async deletePlace(placeId: string) {
    this.places.delete(placeId);
    for (const [id, photo] of this.photos.entries()) {
      if (photo.place_id === placeId) this.photos.delete(id);
    }
  }
}

export class MemorySessionStore implements SessionStore {
  sessions = new Map<number, BotSession>();

  async get(telegramId: number) {
    const session = this.sessions.get(telegramId);
    return session ? structuredClone(session) : null;
  }

  async upsert(session: BotSession) {
    this.sessions.set(session.telegram_id, structuredClone(session));
  }

  async clear(telegramId: number) {
    this.sessions.delete(telegramId);
  }
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  rows = new Map<number, "processing" | "completed">();

  async claimUpdate(updateId: number) {
    const existing = this.rows.get(updateId);
    if (!existing) {
      this.rows.set(updateId, "processing");
      return "claimed" as const;
    }
    if (existing === "completed") return "completed" as const;
    return "processing" as const;
  }

  async completeUpdate(updateId: number) {
    this.rows.set(updateId, "completed");
  }

  async releaseUpdate(updateId: number) {
    if (this.rows.get(updateId) === "processing") {
      this.rows.delete(updateId);
    }
  }
}

export class MemoryStorage implements StorageClient {
  files = new Map<string, Uint8Array>();
  shouldFail = false;
  signedUrls = new Map<string, string>();

  async uploadFacade(placeId: string, bytes: Uint8Array) {
    if (this.shouldFail) return { ok: false as const, reason: "upload_failed" };
    this.files.set(`${placeId}/facade.jpg`, bytes);
    this.signedUrls.set(
      `${placeId}/facade.jpg`,
      `https://signed.local/${placeId}/facade.jpg`,
    );
    return { ok: true as const };
  }

  async removeFacade(placeId: string) {
    this.files.delete(`${placeId}/facade.jpg`);
    this.signedUrls.delete(`${placeId}/facade.jpg`);
  }

  async getFacadeSignedUrl(storagePath: string) {
    return this.signedUrls.get(storagePath) ?? null;
  }
}

export class RecordingTelegram implements TelegramClient {
  messages: OutgoingMessage[] = [];
  callbacks: string[] = [];
  photos: Array<{ chat_id: number; photo: string; caption?: string }> = [];
  shouldFailSend = false;

  async sendMessage(msg: OutgoingMessage) {
    if (this.shouldFailSend) throw new Error("telegram_send_message_failed");
    this.messages.push(msg);
  }

  async sendPhoto(input: { chat_id: number; photo: string; caption?: string }) {
    if (this.shouldFailSend) throw new Error("telegram_send_photo_failed");
    this.photos.push(input);
  }

  async answerCallbackQuery(id: string, text?: string) {
    this.callbacks.push(id);
    if (text) this.messages.push({ chat_id: 0, text });
  }

  async getFile(_fileId: string) {
    return { file_path: "photos/test.jpg" };
  }

  async downloadFile(_filePath: string) {
    return new Uint8Array([1, 2, 3]);
  }
}

export function defaultAudit(): AuditFields {
  return {
    steps_count: null,
    step_height_cm: null,
    ramp_type: "none",
    door_width_cm: null,
    entrance_notes: null,
    toilet_exists: "unknown",
    toilet_accessible: "unknown",
    parking: "unknown",
    comment: null,
  };
}
