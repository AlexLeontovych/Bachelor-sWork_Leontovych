import { z } from 'npm:zod@4.3.6'
import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient, getAuthenticatedUser } from '../_shared/supabase.ts'
import { getOwnedTeamWorkspace } from '../_shared/workspaceOwnership.ts'

const logger = createLogger('respond-workspace-join-request')

const requestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
  workflowRole: z.enum(['developer', 'qa']).optional()
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
    const adminClient = createAdminClient()

    const { data: joinRequest, error: joinRequestError } = await adminClient
      .from('workspace_join_requests')
      .select(`
        id,
        workspace_id,
        requester_user_id,
        status,
        workspace:workspaces!inner (
          id,
          name,
          type,
          status,
          owner_user_id
        )
      `)
      .eq('id', parsedRequest.requestId)
      .maybeSingle()

    if (joinRequestError) {
      throw joinRequestError
    }

    if (!joinRequest?.id || !joinRequest.workspace?.id) {
      throw new Error('The workspace join request is no longer available.')
    }

    if (joinRequest.status !== 'pending') {
      throw new Error('This workspace join request has already been reviewed.')
    }

    await getOwnedTeamWorkspace({
      adminClient,
      workspaceId: joinRequest.workspace_id,
      userId: user.id
    })

    if (parsedRequest.action === 'decline') {
      const { error: declineError } = await adminClient
        .from('workspace_join_requests')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString(),
          responded_by: user.id
        })
        .eq('id', joinRequest.id)

      if (declineError) {
        throw declineError
      }

      await adminClient.rpc('insert_project_notification', {
        target_workspace_id: joinRequest.workspace_id,
        target_project_id: null,
        target_recipient_user_id: joinRequest.requester_user_id,
        target_actor_user_id: user.id,
        notification_type: 'workspace_join_declined',
        notification_title: 'Workspace request declined',
        notification_body: `Your request to join ${joinRequest.workspace.name} was declined.`
      })

      return jsonResponse({
        requestId: joinRequest.id,
        workspaceId: joinRequest.workspace_id,
        status: 'declined'
      })
    }

    if (!parsedRequest.workflowRole) {
      throw new Error('Select a workspace role before accepting the request.')
    }

    const { data: membership, error: membershipError } = await adminClient
      .from('workspace_members')
      .upsert(
        {
          workspace_id: joinRequest.workspace_id,
          user_id: joinRequest.requester_user_id,
          role: 'member',
          workflow_role: parsedRequest.workflowRole
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

    const { error: acceptError } = await adminClient
      .from('workspace_join_requests')
      .update({
        status: 'accepted',
        workflow_role: parsedRequest.workflowRole,
        responded_at: new Date().toISOString(),
        responded_by: user.id
      })
      .eq('id', joinRequest.id)

    if (acceptError) {
      throw acceptError
    }

    await adminClient.rpc('insert_project_notification', {
      target_workspace_id: joinRequest.workspace_id,
      target_project_id: null,
      target_recipient_user_id: joinRequest.requester_user_id,
      target_actor_user_id: user.id,
      notification_type: 'workspace_join_accepted',
      notification_title: 'Workspace request accepted',
      notification_body: `Your request to join ${joinRequest.workspace.name} was accepted. You can switch to this workspace now.`
    })

    return jsonResponse({
      requestId: joinRequest.id,
      membershipId: membership.id,
      workspaceId: joinRequest.workspace_id,
      workspaceName: joinRequest.workspace.name,
      workspaceType: joinRequest.workspace.type,
      workspaceRole: membership.role,
      workflowRole: membership.workflow_role,
      ownerUserId: joinRequest.workspace.owner_user_id,
      status: 'accepted'
    })
  } catch (error) {
    logger.error('Failed to respond to workspace join request.', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to update the workspace join request.'
      },
      400
    )
  }
})
