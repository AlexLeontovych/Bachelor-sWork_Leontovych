import { z } from 'npm:zod@4.3.6'
import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient, ensureProfileRecord, getAuthenticatedUser } from '../_shared/supabase.ts'

const logger = createLogger('respond-workspace-invite')

const requestSchema = z.object({
  workspaceId: z.string().uuid(),
  action: z.enum(['accept', 'decline'])
})

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
    await ensureProfileRecord({
      adminClient,
      user
    })

    const normalizedEmail = user.email.trim().toLowerCase()
    const { data: invite, error: inviteError } = await adminClient
      .from('workspace_invites')
      .select(`
        id,
        workspace_id,
        expires_at,
        workflow_role,
        workspace:workspaces!inner (
          id,
          name,
          type,
          status,
          owner_user_id
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

    if (parsedRequest.action === 'decline') {
      const { error: declineError } = await adminClient
        .from('workspace_invites')
        .update({
          status: 'declined',
          updated_at: new Date().toISOString()
        })
        .eq('id', invite.id)

      if (declineError) {
        throw declineError
      }

      return jsonResponse({
        workspaceId: invite.workspace_id,
        status: 'declined'
      })
    }

    const { error: acceptInviteError } = await adminClient
      .from('workspace_invites')
      .update({
        status: 'accepted',
        claimed_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', invite.id)

    if (acceptInviteError) {
      throw acceptInviteError
    }

    const { data: membership, error: membershipError } = await adminClient
      .from('workspace_members')
      .upsert(
        {
          workspace_id: invite.workspace_id,
          user_id: user.id,
          role: 'member',
          workflow_role: invite.workflow_role
        },
        {
          onConflict: 'workspace_id,user_id'
        }
      )
      .select('id, role, workflow_role')
      .single()

    if (membershipError) {
      throw membershipError
    }

    return jsonResponse({
      membershipId: membership.id,
      workspaceId: invite.workspace.id,
      workspaceName: invite.workspace.name,
      workspaceType: invite.workspace.type,
      workspaceRole: membership.role,
      workflowRole: membership.workflow_role,
      ownerUserId: invite.workspace.owner_user_id
    })
  } catch (error) {
    logger.error('Failed to respond to the workspace invitation.', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to update the workspace invitation.'
      },
      400
    )
  }
})
