import { describe, it, expect } from 'vitest'
import type { Role } from '../../types'
import {
  ADMIN_ROLES,
  MAPPER_ROLES,
  canAddPlace,
  canViewAdminPanel,
  canDeletePlace,
  canChangePlaceStatus,
  canModeratePlace,
} from '../capabilities'

const ALL_ROLES: Role[] = ['owner', 'admin', 'operator', 'tester', 'public_user', 'banned']

describe('capability boundaries', () => {
  it('admins can view the admin panel; mappers and restricted roles cannot', () => {
    expect(ADMIN_ROLES.every((role) => canViewAdminPanel(role))).toBe(true)
    expect(MAPPER_ROLES.every((role) => !canViewAdminPanel(role))).toBe(true)
    expect(!canViewAdminPanel('public_user')).toBe(true)
    expect(!canViewAdminPanel('banned')).toBe(true)
    expect(!canViewAdminPanel(null)).toBe(true)
    expect(!canViewAdminPanel(undefined)).toBe(true)
  })

  it('admins and mappers can add places; public and banned users cannot', () => {
    const allowed = [...ADMIN_ROLES, ...MAPPER_ROLES]
    expect(allowed.every((role) => canAddPlace(role))).toBe(true)

    const disallowed: (Role | null | undefined)[] = ['public_user', 'banned', null, undefined]
    expect(disallowed.every((role) => !canAddPlace(role))).toBe(true)
  })

  it('only admins can delete places', () => {
    expect(ADMIN_ROLES.every((role) => canDeletePlace(role))).toBe(true)
    expect(MAPPER_ROLES.every((role) => !canDeletePlace(role))).toBe(true)
    expect(!canDeletePlace('public_user')).toBe(true)
    expect(!canDeletePlace('banned')).toBe(true)
    expect(!canDeletePlace(null)).toBe(true)
  })

  it('admins can change any status; mappers only their own; public/banned cannot', () => {
    // Admin can moderate any place, including one they did not author.
    expect(canChangePlaceStatus('owner', false)).toBe(true)
    expect(canChangePlaceStatus('admin', false)).toBe(true)

    // Mappers may change status only on places they authored.
    expect(canChangePlaceStatus('operator', true)).toBe(true)
    expect(canChangePlaceStatus('operator', false)).toBe(false)
    expect(canChangePlaceStatus('tester', true)).toBe(true)
    expect(canChangePlaceStatus('tester', false)).toBe(false)

    // Public and banned users have no moderation rights.
    expect(canChangePlaceStatus('public_user', true)).toBe(false)
    expect(canChangePlaceStatus('public_user', false)).toBe(false)
    expect(canChangePlaceStatus('banned', true)).toBe(false)
    expect(canChangePlaceStatus('banned', false)).toBe(false)
    expect(canChangePlaceStatus(null, true)).toBe(false)
  })

  it('canModeratePlace is an alias for canChangePlaceStatus', () => {
    ALL_ROLES.forEach((role) => {
      expect(canModeratePlace(role, true)).toBe(canChangePlaceStatus(role, true))
      expect(canModeratePlace(role, false)).toBe(canChangePlaceStatus(role, false))
    })
  })
})
