import { assertEquals } from "@std/assert";
import { GENERIC_DENIAL, resolveAuditorAccess } from "./auth.ts";
import { makeProfile } from "./test_helpers.ts";

Deno.test("unknown telegram profile is denied", () => {
  const result = resolveAuditorAccess(null);
  assertEquals(result, { allowed: false, reason: "unknown" });
});

Deno.test("public_user and banned are denied generically", () => {
  assertEquals(resolveAuditorAccess(makeProfile({ role: "public_user" })), {
    allowed: false,
    reason: "denied",
  });
  assertEquals(resolveAuditorAccess(makeProfile({ role: "banned" })), {
    allowed: false,
    reason: "denied",
  });
});

Deno.test("tester operator admin owner are allowed", () => {
  for (const role of ["tester", "operator", "admin", "owner"]) {
    const profile = makeProfile({ role });
    const result = resolveAuditorAccess(profile);
    assertEquals(result.allowed, true);
    if (result.allowed) assertEquals(result.profile.id, profile.id);
  }
});

Deno.test("generic denial message is non-specific", () => {
  assertEquals(GENERIC_DENIAL.includes("координатор"), true);
});
