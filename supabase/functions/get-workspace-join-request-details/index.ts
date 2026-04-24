import { z } from 'npm:zod@4.3.6'
import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient, getAuthenticatedUser } from '../_shared/supabase.ts'
import { getOwnedTeamWorkspace } from '../_shared/workspaceOwnership.ts'

const logger = createLogger('get-workspace-join-request-details')

const requestSchema = z.object({
  workspaceId: z.string().uuid(),
  requesterUserId: z.string().uuid()
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
    const workspace = await getOwnedTeamWorkspace({
      adminClient,
      workspaceId: parsedRequest.workspaceId,
      userId: user.id
    })

    const { data: joinRequest, error: joinRequestError } = await adminClient
      .from('workspace_join_requests')
      .select(`
        id,
        workspace_id,
        requester_user_id,
        status,
        requested_at,
        responded_at,
        workflow_role,
        requester:profiles!workspace_join_requests_requester_user_id_fkey (
          id,
          email,
          full_name,
          role,
          team_role
        )
      `)
      .eq('workspace_id', workspace.id)
      .eq('requester_user_id', parsedRequest.requesterUserId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (joinRequestError) {
      throw joinRequestError
    }

    if (!joinRequest?.id) {
      throw new Error('The workspace join request is no longer available.')
    }

    return jsonResponse({
      requestId: joinRequest.id,
      workspaceId: joinRequest.workspace_id,
      workspaceName: workspace.name,
      requesterUserId: joinRequest.requester_user_id,
      requesterName: joinRequest.requester?.full_name ?? null,
      requesterEmail: joinRequest.requester?.email ?? null,
      requesterProfileRole: joinRequest.requester?.role ?? null,
      requesterTeamRole: joinRequest.requester?.team_role ?? null,
      status: joinRequest.status,
      requestedAt: joinRequest.requested_at,
      respondedAt: joinRequest.responded_at,
      workflowRole: joinRequest.workflow_role
    })
  } catch (error) {
    logger.error('Failed to load workspace join request details.', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to load the workspace join request details.'
      },
      400
    )
  }
})
