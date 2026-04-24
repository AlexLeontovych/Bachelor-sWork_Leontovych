import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { createLogger } from '../lib/logger'
import type {
  JoinWorkspaceResult,
  WorkspaceAccess,
  WorkspaceInvite,
  WorkspaceJoinCredentialsSecret,
  WorkspaceJoinCredentialsSummary,
  WorkspaceMember,
  WorkspacePayment,
  WorkspacePlanType
} from '../features/workspaceOnboarding/types'
import { validateWorkspaceJoinRequest } from '../features/workspaceOnboarding/workspaceJoinCredentials'
import { workspacePlanTypeSchema } from '../features/workspaceOnboarding/workspacePlans'
import { validateWorkspaceInviteCandidate } from '../features/workspaceOnboarding/workspaceInviteUtils'
import { getCurrentProfile } from './authService'

const logger = createLogger({ scope: 'workspaceService' })

const inviteWorkflowRoleSchema = z.enum(['developer', 'qa'])

const createInviteSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().trim().email(),
  workflowRole: inviteWorkflowRoleSchema
})

const paymentSessionResponseSchema = z.object({
  checkoutUrl: z.string().url(),
  orderId: z.string().min(1),
  paymentId: z.string().uuid()
})

const claimInviteResponseSchema = z.object({
  claimedCount: z.number().int().nonnegative()
})

const workspaceIdRequestSchema = z.object({
  workspaceId: z.string().uuid()
})

const workspaceMemberRoleUpdateSchema = z.object({
  membershipId: z.string().uuid(),
  workflowRole: inviteWorkflowRoleSchema
})

const workspaceMemberRemovalSchema = z.object({
  membershipId: z.string().uuid()
})
const workspaceInviteResponseSchema = z.object({
  workspaceId: z.string().uuid(),
  action: z.enum(['accept', 'decline'])
})
const workspaceInviteDetailsSchema = z.object({
  workspaceId: z.string().uuid(),
  workspaceName: z.string().min(1),
  workspaceType: workspacePlanTypeSchema,
  workflowRole: inviteWorkflowRoleSchema,
  workflowRoleLabel: z.string().min(1),
  invitedByUserId: z.string().uuid().nullable(),
  invitedByName: z.string().min(1).nullable(),
  invitedByEmail: z.string().email().nullable(),
  invitedAt: z.string().min(1)
})

const workspaceJoinCredentialsSummarySchema = z.object({
  workspaceId: z.string().uuid(),
  workspaceLogin: z.string().min(1).nullable(),
  hasCredentials: z.boolean(),
  isEnabled: z.boolean(),
  createdAt: z.string().min(1).nullable(),
  rotatedAt: z.string().min(1).nullable()
})

const workspaceJoinCredentialsSecretSchema = workspaceJoinCredentialsSummarySchema.extend({
  workspaceLogin: z.string().min(1),
  workspacePassword: z.string().min(8),
  isNew: z.boolean()
})

const joinWorkspaceResultSchema = z.object({
  membershipId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  workspaceName: z.string().min(1),
  workspaceType: workspacePlanTypeSchema,
  workspaceRole: z.enum(['owner', 'member']),
  workflowRole: z.enum(['developer', 'qa']),
  ownerUserId: z.string().uuid()
})
const pendingWorkspaceJoinRequestSchema = z.object({
  requestId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  workspaceName: z.string().min(1),
  workspaceType: workspacePlanTypeSchema,
  ownerUserId: z.string().uuid(),
  status: z.literal('pending_approval'),
  requestedAt: z.string().min(1)
})
const workspaceJoinByCredentialsResultSchema = z.union([
  joinWorkspaceResultSchema,
  pendingWorkspaceJoinRequestSchema
])
const workspaceJoinRequestDetailsSchema = z.object({
  requestId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  workspaceName: z.string().min(1),
  requesterUserId: z.string().uuid(),
  requesterName: z.string().min(1).nullable(),
  requesterEmail: z.string().email().nullable(),
  requesterProfileRole: z.string().nullable(),
  requesterTeamRole: z.string().nullable(),
  status: z.enum(['pending', 'accepted', 'declined']),
  requestedAt: z.string().min(1),
  respondedAt: z.string().min(1).nullable(),
  workflowRole: inviteWorkflowRoleSchema.nullable()
})
const workspaceJoinRequestResponseSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
  workflowRole: inviteWorkflowRoleSchema.optional()
})
const workspaceJoinRequestDecisionResultSchema = z.union([
  joinWorkspaceResultSchema.extend({
    requestId: z.string().uuid(),
    status: z.literal('accepted')
  }),
  z.object({
    requestId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    status: z.literal('declined')
  })
])

const resolveFunctionErrorMessage = async (error: unknown, fallbackMessage: string): Promise<string> => {
  try {
    if (
      error &&
      typeof error === 'object' &&
      'context' in error &&
      error.context &&
      typeof error.context === 'object' &&
      'json' in error.context &&
      typeof error.context.json === 'function'
    ) {
      const errorPayload = await error.context.json()

      if (typeof errorPayload?.error === 'string' && errorPayload.error.trim()) {
        return errorPayload.error
      }
    }
  } catch (contextError) {
    logger.warn('Failed to resolve the workspace function error payload.', { error, contextError })
  }

  return error instanceof Error && error.message ? error.message : fallbackMessage
}

const getAuthenticatedUser = async () => {
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    if (error) {
      throw error
    }

    if (!user) {
      throw new Error('User authentication is required to load workspace data.')
    }

    return user
  } catch (error) {
    logger.error('Failed to resolve the current authenticated user.', error)
    throw error
  }
}

const mapWorkspaceAccess = (row: any): WorkspaceAccess | null => {
  try {
    if (!row?.workspace?.id) {
      return null
    }

    return {
      membershipId: row.id,
      workspaceId: row.workspace.id,
      workspaceName: row.workspace.name,
      workspaceType: row.workspace.type,
      workspaceRole: row.role,
      workflowRole: row.workflow_role ?? null,
      workspaceStatus: row.workspace.status,
      ownerUserId: row.workspace.owner_user_id,
      paidAt: row.workspace.paid_at ?? null
    }
  } catch (error) {
    logger.warn('Skipped malformed workspace access row.', { row, error })
    return null
  }
}

/**
 * Loads all active workspace memberships for the current user.
 *
 * @returns {Promise<WorkspaceAccess[]>}
 *
 * @example
 * const workspaces = await listAccessibleWorkspaces()
 */
export const listAccessibleWorkspaces = async (): Promise<WorkspaceAccess[]> => {
  try {
    const user = await getAuthenticatedUser()
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        role,
        workflow_role,
        workspace:workspaces (
          id,
          name,
          type,
          owner_user_id,
          status,
          paid_at,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    const mappedAccess = (data || [])
      .map(mapWorkspaceAccess)
      .filter(Boolean) as WorkspaceAccess[]

    return mappedAccess.sort((leftWorkspace, rightWorkspace) => {
      if (leftWorkspace.workspaceRole !== rightWorkspace.workspaceRole) {
        return leftWorkspace.workspaceRole === 'owner' ? -1 : 1
      }

      return leftWorkspace.workspaceName.localeCompare(rightWorkspace.workspaceName)
    })
  } catch (error) {
    logger.error('Failed to load accessible workspaces.', error)
    throw new Error('Unable to load workspace access for the current user.')
  }
}

/**
 * Loads the signed-in user profile decorated with the active workspace membership.
 *
 * @param {string} workspaceId
 * @returns {Promise<Record<string, unknown> | null>}
 *
 * @example
 * const profile = await getCurrentWorkspaceProfile(activeWorkspaceId)
 */
export const getCurrentWorkspaceProfile = async (workspaceId: string) => {
  try {
    const [profile, user] = await Promise.all([getCurrentProfile(), getAuthenticatedUser()])

    const { data: membership, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        role,
        workflow_role,
        workspace:workspaces (
          id,
          type,
          name
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!profile) {
      return null
    }

    return {
      ...profile,
      workspace_role: membership?.role ?? null,
      workspaceRole: membership?.role ?? null,
      workspace_type: membership?.workspace?.type ?? null,
      workspaceType: membership?.workspace?.type ?? null,
      workspace_name: membership?.workspace?.name ?? null,
      workspaceName: membership?.workspace?.name ?? null,
      team_role: membership?.workflow_role ?? profile.team_role ?? 'developer',
      teamRole: membership?.workflow_role ?? profile.team_role ?? 'developer'
    }
  } catch (error) {
    logger.error('Failed to load the workspace-aware profile.', { workspaceId, error })
    throw new Error('Unable to load the active workspace profile.')
  }
}

/**
 * Loads workspace members with profile data for assigners and invite management.
 *
 * @param {string} workspaceId
 * @returns {Promise<WorkspaceMember[]>}
 *
 * @example
 * const members = await getWorkspaceMembers(workspaceId)
 */
export const getWorkspaceMembers = async (workspaceId: string): Promise<WorkspaceMember[]> => {
  try {
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('id, workspace_id, user_id, role, workflow_role')
      .eq('workspace_id', workspaceId)

    if (membershipError) {
      throw membershipError
    }

    const userIds = (memberships || []).map((membership) => membership.user_id).filter(Boolean)

    if (userIds.length === 0) {
      return []
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, banned')
      .in('id', userIds)

    if (profileError) {
      throw profileError
    }

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))

    return (memberships || [])
      .map((membership) => {
        const profile = profileMap.get(membership.user_id)

        return {
          id: membership.id,
          workspaceId: membership.workspace_id,
          userId: membership.user_id,
          email: profile?.email ?? null,
          fullName: profile?.full_name ?? null,
          membershipRole: membership.role,
          workflowRole: membership.workflow_role ?? null,
          profileRole: profile?.role ?? null,
          banned: Boolean(profile?.banned)
        } satisfies WorkspaceMember
      })
      .sort((leftMember, rightMember) => {
        if (leftMember.membershipRole !== rightMember.membershipRole) {
          return leftMember.membershipRole === 'owner' ? -1 : 1
        }

        return (leftMember.fullName || leftMember.email || '').localeCompare(
          rightMember.fullName || rightMember.email || ''
        )
      })
  } catch (error) {
    logger.error('Failed to load workspace members.', { workspaceId, error })
    throw new Error('Unable to load workspace members.')
  }
}

/**
 * Loads pending and historical invites for the selected workspace.
 *
 * @param {string} workspaceId
 * @returns {Promise<WorkspaceInvite[]>}
 *
 * @example
 * const invites = await getWorkspaceInvites(workspaceId)
 */
export const getWorkspaceInvites = async (workspaceId: string): Promise<WorkspaceInvite[]> => {
  try {
    const { data, error } = await supabase
      .from('workspace_invites')
      .select('id, workspace_id, email, workflow_role, status, invited_by, claimed_by, expires_at, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return (data || []).map((invite) => ({
      id: invite.id,
      workspaceId: invite.workspace_id,
      email: invite.email,
      workflowRole: invite.workflow_role,
      status: invite.status,
      invitedBy: invite.invited_by,
      claimedBy: invite.claimed_by,
      expiresAt: invite.expires_at,
      createdAt: invite.created_at,
      updatedAt: invite.updated_at
    }))
  } catch (error) {
    logger.error('Failed to load workspace invites.', { workspaceId, error })
    throw new Error('Unable to load workspace invites.')
  }
}

/**
 * Creates a pending email invite for the active team workspace.
 *
 * @param {{ workspaceId: string, email: string, workflowRole: 'developer' | 'qa' }} input
 * @returns {Promise<WorkspaceInvite>}
 *
 * @example
 * await createWorkspaceInvite({ workspaceId, email: 'qa@example.com', workflowRole: 'qa' })
 */
export const createWorkspaceInvite = async (input: {
  workspaceId: string
  email: string
  workflowRole: 'developer' | 'qa'
}): Promise<WorkspaceInvite> => {
  try {
    const validatedInput = createInviteSchema.parse(input)
    const members = await getWorkspaceMembers(validatedInput.workspaceId)
    const { normalizedEmail } = validateWorkspaceInviteCandidate({
      email: validatedInput.email,
      members
    })

    const { data: existingInvite, error: existingInviteError } = await supabase
      .from('workspace_invites')
      .select('id')
      .eq('workspace_id', validatedInput.workspaceId)
      .eq('email_normalized', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingInviteError) {
      throw existingInviteError
    }

    if (existingInvite?.id) {
      throw new Error('There is already a pending invite for this email.')
    }

    const { data, error } = await supabase
      .from('workspace_invites')
      .insert({
        workspace_id: validatedInput.workspaceId,
        email: normalizedEmail,
        email_normalized: normalizedEmail,
        workflow_role: validatedInput.workflowRole
      })
      .select('id, workspace_id, email, workflow_role, status, invited_by, claimed_by, expires_at, created_at, updated_at')
      .single()

    if (error) {
      throw error
    }

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      email: data.email,
      workflowRole: data.workflow_role,
      status: data.status,
      invitedBy: data.invited_by,
      claimedBy: data.claimed_by,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }
  } catch (error) {
    logger.error('Failed to create a workspace invite.', { input, error })
    throw error instanceof Error ? error : new Error('Unable to create the workspace invite.')
  }
}

/**
 * Revokes a previously created workspace invite.
 *
 * @param {string} inviteId
 * @returns {Promise<void>}
 *
 * @example
 * await revokeWorkspaceInvite(inviteId)
 */
export const revokeWorkspaceInvite = async (inviteId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('workspace_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)

    if (error) {
      throw error
    }
  } catch (error) {
    logger.error('Failed to revoke a workspace invite.', { inviteId, error })
    throw new Error('Unable to revoke the workspace invite.')
  }
}

/**
 * Updates a non-owner workspace member workflow role.
 *
 * @param {{ membershipId: string, workflowRole: 'developer' | 'qa' }} input
 * @returns {Promise<void>}
 *
 * @example
 * await updateWorkspaceMemberRole({ membershipId, workflowRole: 'qa' })
 */
export const updateWorkspaceMemberRole = async (input: {
  membershipId: string
  workflowRole: 'developer' | 'qa'
}): Promise<void> => {
  try {
    const validatedInput = workspaceMemberRoleUpdateSchema.parse(input)
    const { data, error } = await supabase
      .from('workspace_members')
      .update({ workflow_role: validatedInput.workflowRole })
      .eq('id', validatedInput.membershipId)
      .neq('role', 'owner')
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data?.id) {
      throw new Error('Only non-owner workspace members can have their access role changed.')
    }
  } catch (error) {
    logger.error('Failed to update a workspace member role.', { input, error })
    throw error instanceof Error ? error : new Error('Unable to update the workspace member role.')
  }
}

/**
 * Removes a non-owner member from the active corporate workspace.
 *
 * @param {string} membershipId
 * @returns {Promise<void>}
 *
 * @example
 * await removeWorkspaceMember(membershipId)
 */
export const removeWorkspaceMember = async (membershipId: string): Promise<void> => {
  try {
    const validatedInput = workspaceMemberRemovalSchema.parse({ membershipId })
    const { data, error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', validatedInput.membershipId)
      .neq('role', 'owner')
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data?.id) {
      throw new Error('Only non-owner workspace members can be removed.')
    }
  } catch (error) {
    logger.error('Failed to remove a workspace member.', { membershipId, error })
    throw error instanceof Error ? error : new Error('Unable to remove the workspace member.')
  }
}

/**
 * Claims pending email invites that match the authenticated user email.
 *
 * @returns {Promise<number>}
 *
 * @example
 * const claimedCount = await claimPendingWorkspaceInvites()
 */
export const claimPendingWorkspaceInvites = async (): Promise<number> => {
  try {
    const { data, error } = await supabase.functions.invoke('claim-pending-invites')

    if (error) {
      throw error
    }

    const parsedResponse = claimInviteResponseSchema.parse(data)
    return parsedResponse.claimedCount
  } catch (error) {
    logger.error('Failed to claim pending workspace invites.', error)
    throw new Error('Unable to claim pending workspace invites.')
  }
}

/**
 * Loads current user's pending workspace invite details for the confirmation modal.
 *
 * @param {string} workspaceId
 * @returns {Promise<z.infer<typeof workspaceInviteDetailsSchema>>}
 *
 * @example
 * const details = await getWorkspaceInviteDetails(workspaceId)
 */
export const getWorkspaceInviteDetails = async (
  workspaceId: string
): Promise<z.infer<typeof workspaceInviteDetailsSchema>> => {
  try {
    const validatedInput = workspaceIdRequestSchema.parse({ workspaceId })
    const { data, error } = await supabase.functions.invoke('get-workspace-invite-details', {
      body: validatedInput
    })

    if (error) {
      throw error
    }

    return workspaceInviteDetailsSchema.parse(data)
  } catch (error) {
    const errorMessage = await resolveFunctionErrorMessage(error, 'Unable to load the workspace invitation details.')
    logger.error('Failed to load workspace invite details.', { workspaceId, error, errorMessage })
    throw new Error(errorMessage)
  }
}

/**
 * Accepts or declines the current user's pending workspace invite.
 *
 * @param {{ workspaceId: string, action: 'accept' | 'decline' }} input
 * @returns {Promise<JoinWorkspaceResult | { workspaceId: string; status: 'declined' }>}
 *
 * @example
 * await respondToWorkspaceInvite({ workspaceId, action: 'decline' })
 */
export const respondToWorkspaceInvite = async (input: {
  workspaceId: string
  action: 'accept' | 'decline'
}): Promise<JoinWorkspaceResult | { workspaceId: string; status: 'declined' }> => {
  try {
    const validatedInput = workspaceInviteResponseSchema.parse(input)
    const { data, error } = await supabase.functions.invoke('respond-workspace-invite', {
      body: validatedInput
    })

    if (error) {
      throw error
    }

    if (validatedInput.action === 'decline') {
      return z.object({
        workspaceId: z.string().uuid(),
        status: z.literal('declined')
      }).parse(data)
    }

    return joinWorkspaceResultSchema.parse(data)
  } catch (error) {
    const errorMessage = await resolveFunctionErrorMessage(error, 'Unable to update the workspace invitation.')
    logger.error('Failed to respond to the workspace invite.', { input, error, errorMessage })
    throw new Error(errorMessage)
  }
}

/**
 * Joins an existing paid corporate workspace by login and password.
 *
 * @param {{ workspaceLogin: string, workspacePassword: string }} input
 * @returns {Promise<JoinWorkspaceResult>}
 *
 * @example
 * const result = await joinWorkspaceWithCredentials({ workspaceLogin: 'aurora-1a2b3c4d', workspacePassword: 'Secret123!' })
 */
export const joinWorkspaceWithCredentials = async (input: {
  workspaceLogin: string
  workspacePassword: string
}): Promise<JoinWorkspaceResult | z.infer<typeof pendingWorkspaceJoinRequestSchema>> => {
  try {
    const validatedInput = validateWorkspaceJoinRequest(input)
    const { data, error } = await supabase.functions.invoke('join-workspace', {
      body: validatedInput
    })

    if (error) {
      throw error
    }

    return workspaceJoinByCredentialsResultSchema.parse(data)
  } catch (error) {
    const errorMessage = await resolveFunctionErrorMessage(error, 'Unable to join the workspace.')
    logger.error('Failed to join the workspace with shared credentials.', { input, error, errorMessage })
    throw new Error(errorMessage)
  }
}

/**
 * Loads a team lead's pending workspace join request details.
 *
 * @param {{ workspaceId: string, requesterUserId: string }} input
 * @returns {Promise<z.infer<typeof workspaceJoinRequestDetailsSchema>>}
 *
 * @example
 * const request = await getWorkspaceJoinRequestDetails({ workspaceId, requesterUserId })
 */
export const getWorkspaceJoinRequestDetails = async (input: {
  workspaceId: string
  requesterUserId: string
}): Promise<z.infer<typeof workspaceJoinRequestDetailsSchema>> => {
  try {
    const validatedInput = z.object({
      workspaceId: z.string().uuid(),
      requesterUserId: z.string().uuid()
    }).parse(input)
    const { data, error } = await supabase.functions.invoke('get-workspace-join-request-details', {
      body: validatedInput
    })

    if (error) {
      throw error
    }

    return workspaceJoinRequestDetailsSchema.parse(data)
  } catch (error) {
    const errorMessage = await resolveFunctionErrorMessage(error, 'Unable to load the workspace join request details.')
    logger.error('Failed to load workspace join request details.', { input, error, errorMessage })
    throw new Error(errorMessage)
  }
}

/**
 * Accepts or declines a workspace join request submitted through shared credentials.
 *
 * @param {{ requestId: string, action: 'accept' | 'decline', workflowRole?: 'developer' | 'qa' }} input
 * @returns {Promise<z.infer<typeof workspaceJoinRequestDecisionResultSchema>>}
 *
 * @example
 * await respondToWorkspaceJoinRequest({ requestId, action: 'accept', workflowRole: 'developer' })
 */
export const respondToWorkspaceJoinRequest = async (
  input: z.infer<typeof workspaceJoinRequestResponseSchema>
): Promise<z.infer<typeof workspaceJoinRequestDecisionResultSchema>> => {
  try {
    const validatedInput = workspaceJoinRequestResponseSchema.parse(input)
    const { data, error } = await supabase.functions.invoke('respond-workspace-join-request', {
      body: validatedInput
    })

    if (error) {
      throw error
    }

    return workspaceJoinRequestDecisionResultSchema.parse(data)
  } catch (error) {
    const errorMessage = await resolveFunctionErrorMessage(error, 'Unable to update the workspace join request.')
    logger.error('Failed to respond to workspace join request.', { input, error, errorMessage })
    throw new Error(errorMessage)
  }
}

/**
 * Loads the owner-facing workspace credentials summary without exposing the password hash.
 *
 * @param {string} workspaceId
 * @returns {Promise<WorkspaceJoinCredentialsSummary>}
 *
 * @example
 * const summary = await getWorkspaceJoinCredentialsSummary(workspaceId)
 */
export const getWorkspaceJoinCredentialsSummary = async (
  workspaceId: string
): Promise<WorkspaceJoinCredentialsSummary> => {
  try {
    const validatedInput = workspaceIdRequestSchema.parse({ workspaceId })
    const { data, error } = await supabase.functions.invoke('get-workspace-credentials', {
      body: validatedInput
    })

    if (error) {
      throw error
    }

    return workspaceJoinCredentialsSummarySchema.parse(data)
  } catch (error) {
    const errorMessage = await resolveFunctionErrorMessage(error, 'Unable to load the workspace credentials.')
    logger.error('Failed to load the workspace credentials summary.', { workspaceId, error, errorMessage })
    throw new Error(errorMessage)
  }
}

/**
 * Generates or rotates the workspace join password for the active team lead.
 *
 * @param {string} workspaceId
 * @returns {Promise<WorkspaceJoinCredentialsSecret>}
 *
 * @example
 * const credentials = await rotateWorkspaceJoinCredentials(workspaceId)
 */
export const rotateWorkspaceJoinCredentials = async (
  workspaceId: string
): Promise<WorkspaceJoinCredentialsSecret> => {
  try {
    const validatedInput = workspaceIdRequestSchema.parse({ workspaceId })
    const { data, error } = await supabase.functions.invoke('rotate-workspace-credentials', {
      body: validatedInput
    })

    if (error) {
      throw error
    }

    return workspaceJoinCredentialsSecretSchema.parse(data)
  } catch (error) {
    const errorMessage = await resolveFunctionErrorMessage(error, 'Unable to rotate the workspace credentials.')
    logger.error('Failed to rotate the workspace credentials.', { workspaceId, error, errorMessage })
    throw new Error(errorMessage)
  }
}

/**
 * Starts a hosted checkout session for the selected workspace plan.
 *
 * @param {WorkspacePlanType} planType
 * @returns {Promise<{ checkoutUrl: string, orderId: string, paymentId: string }>}
 *
 * @example
 * const checkoutSession = await createWorkspaceCheckoutSession('personal')
 */
export const createWorkspaceCheckoutSession = async (
  planType: WorkspacePlanType
): Promise<{ checkoutUrl: string; orderId: string; paymentId: string }> => {
  try {
    const validatedPlanType = workspacePlanTypeSchema.parse(planType)
    const { data, error } = await supabase.functions.invoke('create-payment-session', {
      body: {
        planType: validatedPlanType
      }
    })

    if (error) {
      throw error
    }

    return paymentSessionResponseSchema.parse(data)
  } catch (error) {
    const errorMessage = await resolveFunctionErrorMessage(error, 'Unable to start the payment session.')
    logger.error('Failed to create the workspace checkout session.', { planType, error, errorMessage })
    throw new Error(errorMessage)
  }
}

/**
 * Loads the latest payment state for a hosted checkout order.
 *
 * @param {string} orderId
 * @returns {Promise<WorkspacePayment | null>}
 *
 * @example
 * const payment = await getWorkspacePaymentStatus(orderId)
 */
export const getWorkspacePaymentStatus = async (orderId: string): Promise<WorkspacePayment | null> => {
  try {
    const { data, error } = await supabase
      .from('workspace_payments')
      .select('id, provider_order_id, workspace_id, plan_type, amount_minor, currency, status, paid_at, created_at, checkout_url')
      .eq('provider_order_id', orderId)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return null
    }

    return {
      id: data.id,
      orderId: data.provider_order_id,
      workspaceId: data.workspace_id,
      planType: data.plan_type,
      amountMinor: data.amount_minor,
      currency: data.currency,
      status: data.status,
      paidAt: data.paid_at,
      createdAt: data.created_at ?? null,
      checkoutUrl: data.checkout_url
    }
  } catch (error) {
    logger.error('Failed to load workspace payment status.', { orderId, error })
    throw new Error('Unable to load the payment status.')
  }
}
