import { z } from 'npm:zod@4.3.6'
import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient, getAuthenticatedUser } from '../_shared/supabase.ts'

const logger = createLogger('get-workspace-invite-details')

const requestSchema = z.object({
  workspaceId: z.string().uuid()
})

const getWorkflowRoleLabel = (role?: string | null) => {
  switch (role) {
    case 'lead':
      return 'Team Lead'
    case 'qa':
      return 'QA Engineer'
    case 'developer':
      return 'Developer'
    default:
      return 'Workspace member'
  }
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptionsRequest(request)
  if (optionsResponse) {
    return optionsResponse
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const parsedRequest = requestSchema.parse(await request.json())
    const user = await getAuthenticatedUser(request)

    if (!user.email) {
      throw new Error('The authenticated user does not have an email address.')
    }

    const adminClient = createAdminClient()
    const normalizedEmail = user.email.trim().toLowerCase()
    const { data: invite, error: inviteError } = await adminClient
      .from('workspace_invites')
      .select(`
        id,
        workspace_id,
        workflow_role,
        invited_by,
        created_at,
        expires_at,
        workspace:workspaces!inner (
          id,
          name,
          type,
          status
        )
      `)
      .eq('workspace_id', parsedRequest.workspaceId)
      .eq('email_normalized', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle()

    if (inviteError) {
      throw inviteError
    }

    if (!invite?.id || !invite.workspace?.id) {
      throw new Error('The workspace invitation is no longer available.')
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      throw new Error('The workspace invitation has expired.')
    }

    const { data: inviter } = invite.invited_by
      ? await adminClient
          .from('profiles')
          .select('id, email, full_name')
          .eq('id', invite.invited_by)
          .maybeSingle()
      : { data: null }

    return jsonResponse({
      workspaceId: invite.workspace_id,
      workspaceName: invite.workspace.name,
      workspaceType: invite.workspace.type,
      workflowRole: invite.workflow_role,
      workflowRoleLabel: getWorkflowRoleLabel(invite.workflow_role),
      invitedByUserId: invite.invited_by,
      invitedByName: inviter?.full_name ?? null,
      invitedByEmail: inviter?.email ?? null,
      invitedAt: invite.created_at
    })
  } catch (error) {
    logger.error('Failed to load the workspace invitation details.', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to load the workspace invitation details.'
      },
      400
    )
  }
})
