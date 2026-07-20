import type { Role } from '../types'

/**
 * Administrator roles: full moderation capabilities.
 * They may add, edit, delete, and change status on any place.
 */
export const ADMIN_ROLES: Role[] = ['owner', 'admin']

/**
 * Mapper roles: may contribute places and edit their own contributions.
 * They may not delete places or moderate other users' content.
 */
export const MAPPER_ROLES: Role[] = ['operator', 'tester']

/**
 * Roles that are allowed to log in and use the app at all.
 * Banned users are treated as having no capabilities.
 */
export const AUTHENTICATED_ROLES: Role[] = [...ADMIN_ROLES, ...MAPPER_ROLES, 'public_user']

function isKnownRole(role: Role | null | undefined): role is Role {
  return role != null && AUTHENTICATED_ROLES.includes(role)
}

/**
 * Whether a user with the given role may add new places.
 * Admins, operators, and testers may contribute. Public users and banned users may not.
 */
export function canAddPlace(role: Role | null | undefined): boolean {
  return isKnownRole(role) && role !== 'banned' && role !== 'public_user'
}

/**
 * Whether a user with the given role may see the administrator panel.
 * Only owner/admin have moderation UI access.
 */
export function canViewAdminPanel(role: Role | null | undefined): boolean {
  return isKnownRole(role) && ADMIN_ROLES.includes(role)
}

/**
 * Whether a user with the given role may delete any place.
 * Deletion is reserved for administrators.
 */
export function canDeletePlace(role: Role | null | undefined): boolean {
  return canViewAdminPanel(role)
}

/**
 * Whether a user with the given role may change a place's accessibility status.
 * Admins may change any place; mappers may change only places they authored.
 */
export function canChangePlaceStatus(role: Role | null | undefined, isAuthor: boolean): boolean {
  if (!isKnownRole(role) || role === 'banned') return false
  if (ADMIN_ROLES.includes(role)) return true
  return MAPPER_ROLES.includes(role) && isAuthor
}

/**
 * Convenience alias: edit/moderate rights for a place.
 */
export function canModeratePlace(role: Role | null | undefined, isAuthor: boolean): boolean {
  return canChangePlaceStatus(role, isAuthor)
}
