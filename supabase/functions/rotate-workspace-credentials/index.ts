import { z } from 'npm:zod@4.3.6'
import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient, getAuthenticatedUser } from '../_shared/supabase.ts'
import {
  createWorkspaceJoinLogin,
  createWorkspaceJoinPassword,
  hashWorkspaceJoinPassword
} from '../_shared/workspaceCredentials.ts'
import { getOwnedTeamWorkspace } from '../_shared/workspaceOwnership.ts'

const logger = createLogger('rotate-workspace-credentials')

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

    const { data: existingCredentials, error: existingCredentialsError } = await adminClient
      .from('workspace_join_credentials')
      .select('workspace_id, login_normalized, created_at')
      .eq('workspace_id', workspace.id)
      .maybeSingle()

    if (existingCredentialsError) {
      throw existingCredentialsError
    }

    const workspaceLogin =
      existingCredentials?.login_normalized ||
      createWorkspaceJoinLogin({
        workspaceName: workspace.name,
        workspaceId: workspace.id
      })
    const workspacePassword = createWorkspaceJoinPassword()
    const passwordHash = await hashWorkspaceJoinPassword(workspacePassword)
    const rotatedAt = new Date().toISOString()

    const { data: savedCredentials, error: saveCredentialsError } = await adminClient
      .from('workspace_join_credentials')
      .upsert(
        {
          workspace_id: workspace.id,
          login_normalized: workspaceLogin,
          password_hash: passwordHash,
          is_enabled: true,
          rotated_at: rotatedAt
        },
        {
          onConflict: 'workspace_id'
        }
      )
      .select('workspace_id, login_normalized, is_enabled, created_at, rotated_at')
      .single()

    if (saveCredentialsError) {
      throw saveCredentialsError
    }

    return jsonResponse({
      workspaceId: savedCredentials.workspace_id,
      workspaceLogin: savedCredentials.login_normalized,
      workspacePassword,
      hasCredentials: true,
      isEnabled: Boolean(savedCredentials.is_enabled),
      createdAt: savedCredentials.created_at ?? existingCredentials?.created_at ?? null,
      rotatedAt: savedCredentials.rotated_at ?? rotatedAt,
      isNew: !existingCredentials?.login_normalized
    })
  } catch (error) {
    logger.error('Failed to rotate the workspace credentials.', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to rotate the workspace credentials.'
      },
      400
    )
  }
})
