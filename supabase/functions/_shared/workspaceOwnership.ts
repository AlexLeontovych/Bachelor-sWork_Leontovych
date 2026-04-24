import { createAdminClient } from './supabase.ts'

type AdminClient = ReturnType<typeof createAdminClient>

export interface OwnedTeamWorkspace {
  id: string
  name: string
  type: 'team'
  status: 'pending_payment' | 'active' | 'archived'
  ownerUserId: string
}

/**
 * Resolves and validates that the authenticated user owns the requested team workspace.
 *
 * @param {{ adminClient: AdminClient, workspaceId: string, userId: string }} input
 * @returns {Promise<OwnedTeamWorkspace>}
 *
 * @example
 * const workspace = await getOwnedTeamWorkspace({ adminClient, workspaceId, userId })
 */
export const getOwnedTeamWorkspace = async ({
  adminClient,
  workspaceId,
  userId
}: {
  adminClient: AdminClient
  workspaceId: string
  userId: string
}) => {
  const { data: membership, error } = await adminClient
    .from('workspace_members')
    .select(`
      role,
      workspace:workspaces!inner (
        id,
        name,
        type,
        status,
        owner_user_id
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!membership?.workspace?.id) {
    throw new Error('You do not have access to this workspace.')
  }

  if (membership.role !== 'owner') {
    throw new Error('Only team leads can manage workspace credentials.')
  }

  if (membership.workspace.type !== 'team') {
    throw new Error('Workspace credentials are available only for corporate workspaces.')
  }

  if (membership.workspace.status === 'archived') {
    throw new Error('Archived workspaces cannot manage shared access credentials.')
  }

  return {
    id: membership.workspace.id,
    name: membership.workspace.name,
    type: 'team',
    status: membership.workspace.status,
    ownerUserId: membership.workspace.owner_user_id
  }
}
