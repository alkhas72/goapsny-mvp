import { assertEquals } from "@std/assert";
import {
  isActiveCategory,
  isAuditorRole,
  isFinalStatus,
  isGrayPublished,
  mergeVerificationDetails,
  validateCoordinates,
  validateElevator,
  validateFacadePath,
  validateRampType,
  validateTrimmedName,
} from "./validation.ts";

Deno.test("isAuditorRole allows tester/operator/admin/owner only", () => {
  assertEquals(isAuditorRole("tester"), true);
  assertEquals(isAuditorRole("operator"), true);
  assertEquals(isAuditorRole("admin"), true);
  assertEquals(isAuditorRole("owner"), true);
  assertEquals(isAuditorRole("public_user"), false);
  assertEquals(isAuditorRole("banned"), false);
});

Deno.test("final status rejects gray", () => {
  assertEquals(isFinalStatus("green"), true);
  assertEquals(isFinalStatus("gray"), false);
});

Deno.test("validateCoordinates rejects typed strings", () => {
  const result = validateCoordinates("43.0", 41.0);
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, "typed_coordinates_rejected");
});

Deno.test("validateFacadePath requires exact facade path", () => {
  const id = crypto.randomUUID();
  assertEquals(validateFacadePath(id, `${id}/facade.jpg`).ok, true);
  assertEquals(validateFacadePath(id, `${id}/steps.jpg`).ok, false);
});

Deno.test("mergeVerificationDetails preserves unknown keys", () => {
  const merged = mergeVerificationDetails({
    schema_version: 1,
    external_links: { yandex: "https://yandex.ru" },
  }, {
    verifiedAt: "2026-07-14T12:00:00.000Z",
    address: "ул. Тест",
    elevator: "yes",
  });
  assertEquals(merged.external_links?.yandex, "https://yandex.ru");
  assertEquals(merged.verification?.verified_by_role, "auditor");
  assertEquals(merged.address, "ул. Тест");
});

Deno.test("gray queue predicate includes published gray only", () => {
  assertEquals(
    isGrayPublished({ status: "gray", moderation_status: "published" }),
    true,
  );
  assertEquals(
    isGrayPublished({ status: "gray", moderation_status: "hidden" }),
    false,
  );
  assertEquals(
    isGrayPublished({ status: "green", moderation_status: "published" }),
    false,
  );
});

Deno.test("active categories include toilets", () => {
  assertEquals(isActiveCategory("toilets"), true);
  assertEquals(isActiveCategory("other"), false);
});

Deno.test("validateRampType rejects arbitrary text", () => {
  assertEquals(validateRampType("none").ok, true);
  assertEquals(validateRampType("bogus").ok, false);
});

Deno.test("validateElevator rejects arbitrary text", () => {
  assertEquals(validateElevator("yes").ok, true);
  assertEquals(validateElevator("maybe").ok, false);
});

Deno.test("validateTrimmedName rejects empty", () => {
  assertEquals(validateTrimmedName("   ").ok, false);
  assertEquals(validateTrimmedName("Кафе").ok, true);
});
