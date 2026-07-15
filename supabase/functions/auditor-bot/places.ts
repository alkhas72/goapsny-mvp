import { GRAY_PAGE_SIZE } from "./constants.ts";
import {
  defaultAuditFields,
  isFinalStatus,
  isGrayPublished,
  isVerifiedPublished,
  mergeVerificationDetails,
  validateFacadePath,
  validateTrimmedName,
} from "./validation.ts";
import type {
  AuditFields,
  FinalStatus,
  PhotoRow,
  PlaceRow,
  Profile,
} from "./types.ts";

export type PlacesStore = {
  listGrayPublished(offset: number, limit: number): Promise<PlaceRow[]>;
  listVerifiedPublished(offset: number, limit: number): Promise<PlaceRow[]>;
  getPlace(id: string): Promise<PlaceRow | null>;
  getFacadePhoto(placeId: string): Promise<PhotoRow | null>;
  verifyGrayPlace(input: {
    placeId: string;
    status: FinalStatus;
    audit: AuditFields;
    address?: string;
    elevator?: "yes" | "no" | "unknown";
    verifiedAt: string;
  }): Promise<
    { ok: true; place: PlaceRow } | {
      ok: false;
      reason: "stale" | "not_found" | "hidden";
    }
  >;
  publishVerifiedPlace(input: {
    placeId: string;
    profile: Profile;
    name: string;
    category: string;
    lat: number;
    lng: number;
    status: FinalStatus;
    audit: AuditFields;
    address?: string;
    elevator?: "yes" | "no" | "unknown";
    verifiedAt: string;
    facadeUploadedBy: string;
  }): Promise<{ ok: true; place: PlaceRow } | { ok: false; reason: string }>;
  editVerifiedPlace(input: {
    placeId: string;
    status: FinalStatus;
    audit: AuditFields;
    address?: string;
    elevator?: "yes" | "no" | "unknown";
    verifiedAt: string;
    preserve: Pick<
      PlaceRow,
      "created_by" | "source" | "details" | "moderation_status"
    >;
  }): Promise<
    { ok: true; place: PlaceRow } | {
      ok: false;
      reason: "stale" | "not_found" | "hidden" | "invalid_status";
    }
  >;
  deletePlace(placeId: string): Promise<void>;
};

export async function fetchGrayQueue(
  store: PlacesStore,
  page: number,
): Promise<{ places: PlaceRow[]; page: number; hasMore: boolean }> {
  const offset = page * GRAY_PAGE_SIZE;
  const places = await store.listGrayPublished(offset, GRAY_PAGE_SIZE + 1);
  const hasMore = places.length > GRAY_PAGE_SIZE;
  return {
    places: places.slice(0, GRAY_PAGE_SIZE),
    page,
    hasMore,
  };
}

export async function fetchVerifiedQueue(
  store: PlacesStore,
  page: number,
): Promise<{ places: PlaceRow[]; page: number; hasMore: boolean }> {
  const offset = page * GRAY_PAGE_SIZE;
  const places = await store.listVerifiedPublished(offset, GRAY_PAGE_SIZE + 1);
  const hasMore = places.length > GRAY_PAGE_SIZE;
  return {
    places: places.slice(0, GRAY_PAGE_SIZE),
    page,
    hasMore,
  };
}

export function buildVerifyPatch(
  existing: PlaceRow,
  input: {
    status: FinalStatus;
    audit: AuditFields;
    address?: string;
    elevator?: "yes" | "no" | "unknown";
    verifiedAt: string;
  },
): Partial<PlaceRow> {
  return {
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
    moderation_status: "published",
    source: existing.source,
    created_by: existing.created_by,
  };
}

export async function verifyGraySelection(
  store: PlacesStore,
  placeId: string,
  input: {
    status: FinalStatus;
    audit?: Partial<AuditFields>;
    address?: string;
    elevator?: "yes" | "no" | "unknown";
    verifiedAt: string;
  },
): Promise<
  | { ok: true; place: PlaceRow }
  | { ok: false; reason: "stale" | "not_found" | "hidden" | "invalid_status" }
> {
  if (!isFinalStatus(input.status)) {
    return { ok: false, reason: "invalid_status" };
  }
  const place = await store.getPlace(placeId);
  if (!place) return { ok: false, reason: "not_found" };
  if (place.moderation_status === "hidden") {
    return { ok: false, reason: "hidden" };
  }
  if (!isGrayPublished(place)) return { ok: false, reason: "stale" };

  const audit: AuditFields = { ...defaultAuditFields(), ...input.audit };
  return store.verifyGrayPlace({
    placeId,
    status: input.status,
    audit,
    address: input.address,
    elevator: input.elevator,
    verifiedAt: input.verifiedAt,
  });
}

export async function createVerifiedObject(
  store: PlacesStore,
  input: {
    placeId: string;
    profile: Profile;
    name: string;
    category: string;
    lat: number;
    lng: number;
    status: FinalStatus;
    audit?: Partial<AuditFields>;
    address?: string;
    elevator?: "yes" | "no" | "unknown";
    verifiedAt: string;
    facadeUploaded: boolean;
  },
): Promise<{ ok: true; place: PlaceRow } | { ok: false; reason: string }> {
  const nameResult = validateTrimmedName(input.name);
  if (!nameResult.ok) return nameResult;
  if (!isFinalStatus(input.status)) {
    return { ok: false, reason: "invalid_status" };
  }
  if (!input.facadeUploaded) return { ok: false, reason: "facade_required" };
  const pathCheck = validateFacadePath(
    input.placeId,
    `${input.placeId}/facade.jpg`,
  );
  if (!pathCheck.ok) return { ok: false, reason: pathCheck.reason };

  const audit: AuditFields = { ...defaultAuditFields(), ...input.audit };
  return await store.publishVerifiedPlace({
    placeId: input.placeId,
    profile: input.profile,
    name: nameResult.name,
    category: input.category,
    lat: input.lat,
    lng: input.lng,
    status: input.status,
    audit,
    address: input.address,
    elevator: input.elevator,
    verifiedAt: input.verifiedAt,
    facadeUploadedBy: input.profile.id,
  });
}

export async function editVerifiedObject(
  store: PlacesStore,
  placeId: string,
  input: {
    status: FinalStatus;
    audit?: Partial<AuditFields>;
    address?: string;
    elevator?: "yes" | "no" | "unknown";
    verifiedAt: string;
  },
): Promise<
  | { ok: true; place: PlaceRow }
  | { ok: false; reason: "stale" | "not_found" | "hidden" | "invalid_status" }
> {
  if (!isFinalStatus(input.status)) {
    return { ok: false, reason: "invalid_status" };
  }
  const place = await store.getPlace(placeId);
  if (!place) return { ok: false, reason: "not_found" };
  if (place.moderation_status === "hidden") {
    return { ok: false, reason: "hidden" };
  }
  if (!isVerifiedPublished(place)) return { ok: false, reason: "stale" };

  const audit: AuditFields = {
    steps_count: input.audit?.steps_count ?? place.steps_count,
    step_height_cm: input.audit?.step_height_cm ?? place.step_height_cm,
    ramp_type: input.audit?.ramp_type ?? place.ramp_type,
    door_width_cm: input.audit?.door_width_cm ?? place.door_width_cm,
    entrance_notes: input.audit?.entrance_notes ?? place.entrance_notes,
    toilet_exists: input.audit?.toilet_exists ?? place.toilet_exists,
    toilet_accessible: input.audit?.toilet_accessible ??
      place.toilet_accessible,
    parking: input.audit?.parking ?? place.parking,
    comment: input.audit?.comment ?? place.comment,
  };

  return store.editVerifiedPlace({
    placeId,
    status: input.status,
    audit,
    address: input.address,
    elevator: input.elevator,
    verifiedAt: input.verifiedAt,
    preserve: {
      created_by: place.created_by,
      source: place.source,
      details: place.details,
      moderation_status: place.moderation_status,
    },
  });
}

export type StorageClient = {
  uploadFacade(
    placeId: string,
    bytes: Uint8Array,
  ): Promise<{ ok: true } | { ok: false; reason: string }>;
  removeFacade(placeId: string): Promise<void>;
  getFacadeSignedUrl(storagePath: string): Promise<string | null>;
};

export async function uploadFacadePhoto(
  storage: StorageClient,
  placeId: string,
  bytes: Uint8Array,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const pathCheck = validateFacadePath(placeId, `${placeId}/facade.jpg`);
  if (!pathCheck.ok) return pathCheck;
  return await storage.uploadFacade(placeId, bytes);
}

export async function finalizeCreateWithPhoto(
  store: PlacesStore,
  storage: StorageClient,
  input: Parameters<typeof createVerifiedObject>[1] & {
    photoBytes: Uint8Array;
  },
): Promise<{ ok: true; place: PlaceRow } | { ok: false; reason: string }> {
  const upload = await uploadFacadePhoto(
    storage,
    input.placeId,
    input.photoBytes,
  );
  if (!upload.ok) {
    return upload;
  }

  const createResult = await createVerifiedObject(store, {
    ...input,
    facadeUploaded: true,
  });
  if (!createResult.ok) {
    await storage.removeFacade(input.placeId);
    return createResult;
  }

  return createResult;
}
