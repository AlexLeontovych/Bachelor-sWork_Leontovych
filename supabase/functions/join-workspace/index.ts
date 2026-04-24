import { z } from 'npm:zod@4.3.6'
import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient, ensureProfileRecord, getAuthenticatedUser } from '../_shared/supabase.ts'
import { normalizeWorkspaceJoinLogin, verifyWorkspaceJoinPassword } from '../_shared/workspaceCredentials.ts'

const logger = createLogger('join-workspace')

const requestSchema = z.object({
  workspaceLogin: z.string().trim().min(3).max(80),
  workspacePassword: z.string().min(8).max(160)
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
    await ensureProfileRecord({
      adminClient,
      user
    })

    const normalizedWorkspaceLogin = normalizeWorkspaceJoinLogin(parsedRequest.workspaceLogin)
    const { data: credentials, error: credentialsError } = await adminClient
      .from('workspace_join_credentials')
      .select(`
        workspace_id,
        login_normalized,
        password_hash,
        is_enabled,
        workspace:workspaces!inner (
          id,
          name,
          type,
          status,
          owner_user_id
        )
      `)
      .eq('login_normalized', normalizedWorkspaceLogin)
      .maybeSingle()

    if (credentialsError) {
      throw credentialsError
    }

    if (!credentials?.workspace?.id) {
      throw new Error('The workspace login or password is invalid.')
    }

    if (!credentials.is_enabled) {
      throw new Error('Shared access credentials for this workspace are currently disabled.')
    }

    if (credentials.workspace.status === 'archived') {
      throw new Error('This workspace is archived and cannot accept new members.')
    }

    if (credentials.workspace.type !== 'team') {
      throw new Error('Only corporate workspaces support shared join credentials.')
    }

    const passwordMatches = await verifyWorkspaceJoinPassword({
      password: parsedRequest.workspacePassword,
      passwordHash: credentials.password_hash
    })

    if (!passwordMatches) {
      throw new Error('The workspace login or password is invalid.')
    }

    const { data: existingMembership, error: existingMembershipError } = await adminClient
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', credentials.workspace.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingMembershipError) {
      throw existingMembershipError
    }

    if (existingMembership?.id) {
      throw new Error('You already belong to this workspace.')
    }

    const { data: existingRequest, error: existingRequestError } = await adminClient
      .from('workspace_join_requests')
      .select('id, requested_at')
      .eq('workspace_id', credentials.workspace.id)
      .eq('requester_user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingRequestError) {
      throw existingRequestError
    }

    if (existingRequest?.id) {
      return jsonResponse({
        requestId: existingRequest.id,
        workspaceId: credentials.workspace.id,
        workspaceName: credentials.workspace.name,
        workspaceType: credentials.workspace.type,
        ownerUserId: credentials.workspace.owner_user_id,
        status: 'pending_approval',
        requestedAt: existingRequest.requested_at
      })
    }

    const { data: createdRequest, error: createRequestError } = await adminClient
      .from('workspace_join_requests')
      .insert({
        workspace_id: credentials.workspace.id,
        requester_user_id: user.id,
        status: 'pending'
      })
      .select('id, requested_at')
      .single()

    if (createRequestError) {
      throw createRequestError
    }

    const requesterName =
      typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
        ? user.user_metadata.full_name.trim()
        : user.email || 'A workspace user'

    await adminClient.rpc('insert_project_notification', {
      target_workspace_id: credentials.workspace.id,
      target_project_id: null,
      target_recipient_user_id: credentials.workspace.owner_user_id,
      target_actor_user_id: user.id,
      notification_type: 'workspace_join_requested',
      notification_title: 'Workspace join request',
      notification_body: `${requesterName} requested access to ${credentials.workspace.name}. Open this notification to approve or decline.`
    })

    return jsonResponse({
      requestId: createdRequest.id,
      workspaceId: credentials.workspace.id,
      workspaceName: credentials.workspace.name,
      workspaceType: credentials.workspace.type,
      ownerUserId: credentials.workspace.owner_user_id,
      status: 'pending_approval',
      requestedAt: createdRequest.requested_at
    })
  } catch (error) {
    logger.error('Failed to join the workspace by shared credentials.', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to join the workspace.'
      },
      400
    )
  }
})
