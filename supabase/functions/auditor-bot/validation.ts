import {
  ACTIVE_CATEGORY_SLUGS,
  AUDITOR_ROLES,
  FINAL_STATUSES,
} from "./constants.ts";
import type {
  AuditFields,
  FinalStatus,
  PlaceRow,
  VerificationDetails,
} from "./types.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FACADE_PATH_RE = /^[0-9a-f-]{36}\/facade\.jpg$/;

export const RAMP_TYPES = [
  "none",
  "permanent",
  "portable_on_request",
  "portable_available",
] as const;
export const YES_NO_UNKNOWN = ["yes", "no", "unknown"] as const;
export const TOILET_ACCESSIBLE = ["yes", "no", "partial", "unknown"] as const;
export const ELEVATOR_VALUES = ["yes", "no", "unknown"] as const;

export const MAX_ENTRANCE_NOTES = 500;
export const MAX_COMMENT = 1000;
export const MAX_ADDRESS = 200;

export function isAuditorRole(role: string): boolean {
  return (AUDITOR_ROLES as readonly string[]).includes(role);
}

export function isFinalStatus(status: string): status is FinalStatus {
  return (FINAL_STATUSES as readonly string[]).includes(status);
}

export function isActiveCategory(slug: string): boolean {
  return ACTIVE_CATEGORY_SLUGS.includes(slug);
}

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function validateCoordinates(
  lat: unknown,
  lng: unknown,
): { ok: true; lat: number; lng: number } | { ok: false; reason: string } {
  if (typeof lat === "string" || typeof lng === "string") {
    return { ok: false, reason: "typed_coordinates_rejected" };
  }
  if (
    typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) ||
    Number.isNaN(lng)
  ) {
    return { ok: false, reason: "invalid_coordinates" };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, reason: "coordinates_out_of_range" };
  }
  return { ok: true, lat, lng };
}

export function validateFacadePath(
  placeId: string,
  storagePath: string,
): { ok: true } | { ok: false; reason: string } {
  if (!isValidUuid(placeId)) return { ok: false, reason: "invalid_place_id" };
  const expected = `${placeId}/facade.jpg`;
  if (storagePath !== expected || !FACADE_PATH_RE.test(storagePath)) {
    return { ok: false, reason: "invalid_facade_path" };
  }
  return { ok: true };
}

export function validateTrimmedName(
  name: unknown,
): { ok: true; name: string } | { ok: false; reason: string } {
  if (typeof name !== "string") return { ok: false, reason: "name_required" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "name_required" };
  return { ok: true, name: trimmed };
}

export function mergeVerificationDetails(
  existing: Record<string, unknown>,
  input: {
    address?: string;
    elevator?: "yes" | "no" | "unknown";
    verifiedAt: string;
  },
): VerificationDetails {
  const merged: VerificationDetails = {
    ...existing,
    schema_version: 1,
    verification: {
      verified_at: input.verifiedAt,
      verified_by_role: "auditor",
    },
  };
  if (input.address !== undefined) {
    const trimmed = input.address.trim();
    if (trimmed) merged.address = trimmed;
  }
  if (input.elevator !== undefined) merged.elevator = input.elevator;
  return merged;
}

export function isGrayPublished(
  place: Pick<PlaceRow, "status" | "moderation_status">,
): boolean {
  return place.status === "gray" && place.moderation_status === "published";
}

export function isVerifiedPublished(
  place: Pick<PlaceRow, "status" | "moderation_status">,
): boolean {
  return isFinalStatus(place.status) && place.moderation_status === "published";
}

export function stripProtectedPlaceFields<T extends Record<string, unknown>>(
  input: T,
): Partial<PlaceRow> {
  const blocked = new Set([
    "id",
    "created_by",
    "source",
    "moderation_status",
    "created_at",
    "updated_at",
    "osm_tags",
    "location",
  ]);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!blocked.has(key)) result[key] = value;
  }
  return result as Partial<PlaceRow>;
}

export function defaultAuditFields(): AuditFields {
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

export function parseOptionalInt(text: string | undefined): number | null {
  if (!text || text.trim() === "" || text === "-") return null;
  const value = Number(text.trim());
  if (!Number.isInteger(value) || value < 0) throw new Error("invalid_number");
  return value;
}

export function validateRampType(
  value: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  if (!(RAMP_TYPES as readonly string[]).includes(value)) {
    return { ok: false, reason: "invalid_ramp_type" };
  }
  return { ok: true, value };
}

export function validateYesNoUnknown(
  value: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  if (!(YES_NO_UNKNOWN as readonly string[]).includes(value)) {
    return { ok: false, reason: "invalid_enum" };
  }
  return { ok: true, value };
}

export function validateToiletAccessible(
  value: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  if (!(TOILET_ACCESSIBLE as readonly string[]).includes(value)) {
    return { ok: false, reason: "invalid_enum" };
  }
  return { ok: true, value };
}

export function validateElevator(
  value: string,
): { ok: true; value: "yes" | "no" | "unknown" } | {
  ok: false;
  reason: string;
} {
  if (!(ELEVATOR_VALUES as readonly string[]).includes(value)) {
    return { ok: false, reason: "invalid_elevator" };
  }
  return { ok: true, value: value as "yes" | "no" | "unknown" };
}

export function validateBoundedText(
  value: string,
  maxLength: number,
): { ok: true; value: string | null } | { ok: false; reason: string } {
  if (value === "-") return { ok: true, value: null };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > maxLength) {
    return { ok: false, reason: "text_too_long" };
  }
  return { ok: true, value: trimmed };
}

export function sanitizeAuditFields(audit: AuditFields): AuditFields {
  return {
    ...audit,
    ramp_type: validateRampType(audit.ramp_type).ok ? audit.ramp_type : "none",
    toilet_exists: validateYesNoUnknown(audit.toilet_exists).ok
      ? audit.toilet_exists
      : "unknown",
    toilet_accessible: validateToiletAccessible(audit.toilet_accessible).ok
      ? audit.toilet_accessible
      : "unknown",
    parking: validateYesNoUnknown(audit.parking).ok ? audit.parking : "unknown",
  };
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
