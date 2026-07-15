import { assertEquals } from "@std/assert";
import { deliverGrayFacadePreview } from "./facade_delivery.ts";
import {
  makePlace,
  MemoryPlacesStore,
  MemoryStorage,
  RecordingTelegram,
} from "./test_helpers.ts";

Deno.test("gray facade preview sends photo when metadata exists", async () => {
  const place = makePlace({ status: "gray", moderation_status: "published" });
  const store = new MemoryPlacesStore([place], [{
    id: crypto.randomUUID(),
    place_id: place.id,
    storage_path: `${place.id}/facade.jpg`,
    kind: "facade",
    uploaded_by: null,
  }]);
  const storage = new MemoryStorage();
  storage.signedUrls.set(
    `${place.id}/facade.jpg`,
    "https://signed.local/facade.jpg",
  );
  const telegram = new RecordingTelegram();

  const result = await deliverGrayFacadePreview(
    store,
    storage,
    telegram,
    500,
    place.id,
    place.name,
  );
  assertEquals(result, "sent");
  assertEquals(telegram.photos.length, 1);
});

Deno.test("gray facade preview reports missing media", async () => {
  const place = makePlace({ status: "gray", moderation_status: "published" });
  const telegram = new RecordingTelegram();
  const result = await deliverGrayFacadePreview(
    new MemoryPlacesStore([place]),
    new MemoryStorage(),
    telegram,
    500,
    place.id,
    place.name,
  );
  assertEquals(result, "missing");
  assertEquals(telegram.photos.length, 0);
});
