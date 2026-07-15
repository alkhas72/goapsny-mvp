import { assertEquals, assertExists } from "@std/assert";
import {
  createVerifiedObject,
  editVerifiedObject,
  fetchGrayQueue,
  finalizeCreateWithPhoto,
  verifyGraySelection,
} from "./places.ts";
import {
  makePlace,
  makeProfile,
  MemoryPlacesStore,
  MemoryStorage,
} from "./test_helpers.ts";

Deno.test("gray queue includes published gray only", async () => {
  const gray = makePlace({
    status: "gray",
    moderation_status: "published",
    name: "Gray",
  });
  const hidden = makePlace({
    status: "gray",
    moderation_status: "hidden",
    name: "Hidden",
  });
  const colored = makePlace({
    status: "green",
    moderation_status: "published",
    name: "Green",
  });
  const store = new MemoryPlacesStore([gray, hidden, colored]);
  const queue = await fetchGrayQueue(store, 0);
  assertEquals(queue.places.length, 1);
  assertEquals(queue.places[0].name, "Gray");
});

Deno.test("gray to colored keeps id publication creator source and unknown details", async () => {
  const creatorId = crypto.randomUUID();
  const place = makePlace({
    status: "gray",
    moderation_status: "published",
    source: "public",
    created_by: creatorId,
    details: { schema_version: 1, external_links: { osm: "https://osm.org" } },
  });
  const store = new MemoryPlacesStore([place]);
  const result = await verifyGraySelection(store, place.id, {
    status: "green",
    audit: { steps_count: 0 },
    verifiedAt: "2026-07-14T12:00:00.000Z",
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.place.id, place.id);
    assertEquals(result.place.moderation_status, "published");
    assertEquals(result.place.source, "public");
    assertEquals(result.place.created_by, creatorId);
    const details = result.place.details as {
      external_links?: { osm?: string };
      verification?: { verified_by_role?: string };
    };
    assertEquals(details.external_links?.osm, "https://osm.org");
    assertEquals(details.verification?.verified_by_role, "auditor");
  }
});

Deno.test("stale concurrent gray verification is rejected", async () => {
  const place = makePlace({ status: "green", moderation_status: "published" });
  const store = new MemoryPlacesStore([place]);
  const result = await verifyGraySelection(store, place.id, {
    status: "yellow",
    verifiedAt: "2026-07-14T12:00:00.000Z",
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "stale");
});

Deno.test("auditor cannot verify hidden gray object", async () => {
  const place = makePlace({ status: "gray", moderation_status: "hidden" });
  const store = new MemoryPlacesStore([place]);
  const result = await verifyGraySelection(store, place.id, {
    status: "green",
    verifiedAt: "2026-07-14T12:00:00.000Z",
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "hidden");
});

Deno.test("auditor cannot select gray as final verdict", async () => {
  const place = makePlace({ status: "gray", moderation_status: "published" });
  const store = new MemoryPlacesStore([place]);
  const result = await verifyGraySelection(store, place.id, {
    status: "gray" as "green",
    verifiedAt: "2026-07-14T12:00:00.000Z",
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "invalid_status");
});

Deno.test("auditor creates colored published operator object", async () => {
  const profile = makeProfile();
  const store = new MemoryPlacesStore();
  const placeId = crypto.randomUUID();
  const result = await createVerifiedObject(store, {
    placeId,
    profile,
    name: "Новый объект",
    category: "food",
    lat: 43.1,
    lng: 41.2,
    status: "yellow",
    verifiedAt: "2026-07-14T12:00:00.000Z",
    facadeUploaded: true,
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.place.status, "yellow");
    assertEquals(result.place.moderation_status, "published");
    assertEquals(result.place.source, "operator");
    assertEquals(result.place.created_by, profile.id);
  }
});

Deno.test("create without facade is rejected", async () => {
  const profile = makeProfile();
  const store = new MemoryPlacesStore();
  const result = await createVerifiedObject(store, {
    placeId: crypto.randomUUID(),
    profile,
    name: "Без фото",
    category: "food",
    lat: 43.1,
    lng: 41.2,
    status: "green",
    verifiedAt: "2026-07-14T12:00:00.000Z",
    facadeUploaded: false,
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "facade_required");
});

Deno.test("upload failure never leaves visible half-object", async () => {
  const profile = makeProfile();
  const store = new MemoryPlacesStore();
  const storage = new MemoryStorage();
  storage.shouldFail = true;
  const placeId = crypto.randomUUID();
  const result = await finalizeCreateWithPhoto(store, storage, {
    placeId,
    profile,
    name: "Объект",
    category: "shops",
    lat: 43,
    lng: 41,
    status: "green",
    verifiedAt: "2026-07-14T12:00:00.000Z",
    facadeUploaded: true,
    photoBytes: new Uint8Array([1]),
  });
  assertEquals(result.ok, false);
  assertEquals(store.places.size, 0);
});

Deno.test("atomic publish failure leaves no visible place or storage", async () => {
  const profile = makeProfile();
  const store = new MemoryPlacesStore();
  store.publishShouldFail = true;
  const storage = new MemoryStorage();
  const placeId = crypto.randomUUID();
  const result = await finalizeCreateWithPhoto(store, storage, {
    placeId,
    profile,
    name: "Объект",
    category: "shops",
    lat: 43,
    lng: 41,
    status: "green",
    verifiedAt: "2026-07-14T12:00:00.000Z",
    facadeUploaded: true,
    photoBytes: new Uint8Array([1]),
  });
  assertEquals(result.ok, false);
  assertEquals(store.places.has(placeId), false);
  assertEquals(storage.files.has(`${placeId}/facade.jpg`), false);
});

Deno.test("auditor edits colored published object preserving authorship", async () => {
  const creatorId = crypto.randomUUID();
  const place = makePlace({
    status: "green",
    moderation_status: "published",
    source: "public",
    created_by: creatorId,
    details: { schema_version: 1, address: "старый" },
  });
  const store = new MemoryPlacesStore([place]);
  const result = await editVerifiedObject(store, place.id, {
    status: "yellow",
    audit: { steps_count: 2 },
    address: "новый",
    verifiedAt: "2026-07-14T13:00:00.000Z",
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.place.created_by, creatorId);
    assertEquals(result.place.source, "public");
    assertEquals(result.place.status, "yellow");
    assertEquals(result.place.steps_count, 2);
    assertEquals(result.place.details.address, "новый");
  }
});

Deno.test("auditor cannot edit hidden object", async () => {
  const place = makePlace({ status: "green", moderation_status: "hidden" });
  const store = new MemoryPlacesStore([place]);
  const result = await editVerifiedObject(store, place.id, {
    status: "green",
    verifiedAt: "2026-07-14T13:00:00.000Z",
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "hidden");
});

Deno.test("successful create indexes facade photo", async () => {
  const profile = makeProfile();
  const store = new MemoryPlacesStore();
  const storage = new MemoryStorage();
  const placeId = crypto.randomUUID();
  const result = await finalizeCreateWithPhoto(store, storage, {
    placeId,
    profile,
    name: "С фото",
    category: "shops",
    lat: 43,
    lng: 41,
    status: "red",
    verifiedAt: "2026-07-14T12:00:00.000Z",
    facadeUploaded: true,
    photoBytes: new Uint8Array([9, 9, 9]),
  });
  assertEquals(result.ok, true);
  const photo = await store.getFacadePhoto(placeId);
  assertExists(photo);
  assertEquals(photo?.storage_path, `${placeId}/facade.jpg`);
});
