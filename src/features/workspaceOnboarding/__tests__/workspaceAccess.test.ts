import { describe, expect, it } from 'vitest'
import {
  getWorkspacePaymentConfirmationRemainingSeconds,
  isWorkspacePaymentFailureStatus,
  isWorkspacePaymentConfirmationDelayed,
  resolvePostAuthDestination,
  resolveWorkspaceCheckoutAccess,
  selectDefaultWorkspaceAccess
} from '../workspaceAccess'

const ownerWorkspace = {
  membershipId: 'membership-owner',
  workspaceId: 'workspace-owner',
  workspaceName: 'Owner workspace',
  workspaceType: 'team',
  workspaceRole: 'owner',
  workflowRole: null,
  workspaceStatus: 'active',
  ownerUserId: 'user-owner',
  paidAt: null
} as const

const memberWorkspace = {
  membershipId: 'membership-member',
  workspaceId: 'workspace-member',
  workspaceName: 'Member workspace',
  workspaceType: 'team',
  workspaceRole: 'member',
  workflowRole: 'developer',
  workspaceStatus: 'active',
  ownerUserId: 'user-owner',
  paidAt: null
} as const

describe('workspaceAccess', () => {
  it('prefers the stored workspace when it is still accessible', () => {
    const selectedWorkspace = selectDefaultWorkspaceAccess([ownerWorkspace, memberWorkspace], memberWorkspace.workspaceId)
    expect(selectedWorkspace?.workspaceId).toBe(memberWorkspace.workspaceId)
  })

  it('falls back to the owned workspace when the stored workspace is unavailable', () => {
    const selectedWorkspace = selectDefaultWorkspaceAccess([ownerWorkspace, memberWorkspace], 'missing-workspace')
    expect(selectedWorkspace?.workspaceId).toBe(ownerWorkspace.workspaceId)
  })

  it('routes the user to onboarding when no paid workspace is available yet', () => {
    const destination = resolvePostAuthDestination({
      workspaces: [],
      preferredWorkspaceId: null
    })

    expect(destination.nextView).toBe('onboarding')
    expect(destination.workspace).toBeNull()
  })

  it('routes the user to projects when a workspace is available', () => {
    const destination = resolvePostAuthDestination({
      workspaces: [ownerWorkspace, memberWorkspace],
      preferredWorkspaceId: memberWorkspace.workspaceId
    })

    expect(destination.nextView).toBe('projects')
    expect(destination.workspace?.workspaceId).toBe(memberWorkspace.workspaceId)
  })

  it('requires authentication before checkout when the user is still in guest mode', () => {
    const checkoutAccess = resolveWorkspaceCheckoutAccess({
      isGuest: true,
      hasUser: false,
      planType: 'team'
    })

    expect(checkoutAccess.planType).toBe('team')
    expect(checkoutAccess.requiresAuth).toBe(true)
  })

  it('allows checkout to continue when the user is already authenticated', () => {
    const checkoutAccess = resolveWorkspaceCheckoutAccess({
      isGuest: false,
      hasUser: true,
      planType: 'personal'
    })

    expect(checkoutAccess.planType).toBe('personal')
    expect(checkoutAccess.requiresAuth).toBe(false)
  })

  it('treats cancelled and failed payments as terminal checkout failures', () => {
    expect(isWorkspacePaymentFailureStatus('cancelled')).toBe(true)
    expect(isWorkspacePaymentFailureStatus('failed')).toBe(true)
  })

  it('keeps pending and processing payments in the waiting state', () => {
    expect(isWorkspacePaymentFailureStatus('pending')).toBe(false)
    expect(isWorkspacePaymentFailureStatus('processing')).toBe(false)
    expect(isWorkspacePaymentFailureStatus(undefined)).toBe(false)
  })

  it('calculates the remaining confirmation window in seconds', () => {
    expect(
      getWorkspacePaymentConfirmationRemainingSeconds({
        startedAt: 1_000,
        now: 11_000
      })
    ).toBe(50)
  })

  it('marks checkout confirmation as delayed after the 60 second window', () => {
    expect(
      isWorkspacePaymentConfirmationDelayed({
        startedAt: 1_000,
        now: 61_000
      })
    ).toBe(true)

    expect(
      isWorkspacePaymentConfirmationDelayed({
        startedAt: 1_000,
        now: 30_000
      })
    ).toBe(false)
  })
})
