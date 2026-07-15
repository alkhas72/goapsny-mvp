import { assertEquals } from "@std/assert";
import { ownsCallback } from "./idempotency.ts";
import { MemoryIdempotencyStore } from "./test_helpers.ts";

Deno.test("concurrent second claim returns processing", async () => {
  const store = new MemoryIdempotencyStore();
  assertEquals(await store.claimUpdate(42), "claimed");
  assertEquals(await store.claimUpdate(42), "processing");
});

Deno.test("completed claim returns completed", async () => {
  const store = new MemoryIdempotencyStore();
  assertEquals(await store.claimUpdate(7), "claimed");
  await store.completeUpdate(7);
  assertEquals(await store.claimUpdate(7), "completed");
});

Deno.test("release after failure allows retry claim", async () => {
  const store = new MemoryIdempotencyStore();
  assertEquals(await store.claimUpdate(9), "claimed");
  await store.releaseUpdate(9);
  assertEquals(await store.claimUpdate(9), "claimed");
});

Deno.test("callback ownership requires same telegram id", () => {
  assertEquals(ownsCallback(100, 100), true);
  assertEquals(ownsCallback(100, 101), false);
});
