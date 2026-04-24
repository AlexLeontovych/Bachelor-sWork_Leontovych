import { z } from 'npm:zod@4.3.6'
import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient, getAuthenticatedUser } from '../_shared/supabase.ts'
import { getOwnedTeamWorkspace } from '../_shared/workspaceOwnership.ts'

const logger = createLogger('get-workspace-credentials')

const requestSchema = z.object({
  workspaceId: z.string().uuid()
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

    const { data: credentials, error } = await adminClient
      .from('workspace_join_credentials')
      .select('workspace_id, login_normalized, is_enabled, created_at, rotated_at')
      .eq('workspace_id', workspace.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    return jsonResponse({
      workspaceId: workspace.id,
      workspaceLogin: credentials?.login_normalized ?? null,
      hasCredentials: Boolean(credentials?.login_normalized),
      isEnabled: Boolean(credentials?.is_enabled),
      createdAt: credentials?.created_at ?? null,
      rotatedAt: credentials?.rotated_at ?? null
    })
  } catch (error) {
    logger.error('Failed to load the workspace credentials summary.', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to load the workspace credentials.'
      },
      400
    )
  }
})
