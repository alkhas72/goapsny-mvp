import type { Profile } from "./types.ts";
import { isAuditorRole } from "./validation.ts";

/**
 * Auditor access is explicit on profiles.role — never inferred from schema defaults.
 * After T2, profiles.role defaults to public_user; tester is not an implicit grant.
 */
export function resolveAuditorAccess(
  profile: Profile | null,
): { allowed: true; profile: Profile } | {
  allowed: false;
  reason: "unknown" | "denied";
} {
  if (!profile) return { allowed: false, reason: "unknown" };
  if (!isAuditorRole(profile.role)) return { allowed: false, reason: "denied" };
  return { allowed: true, profile };
}

export const GENERIC_DENIAL =
  "Доступ только для авторизованных аудиторов. Обратитесь к координатору.";
