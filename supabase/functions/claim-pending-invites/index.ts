import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient, getAuthenticatedUser } from '../_shared/supabase.ts'

const logger = createLogger('claim-pending-invites')

Deno.serve(async (request) => {
  const optionsResponse = handleOptionsRequest(request)
  if (optionsResponse) {
    return optionsResponse
  }

  try {
    const user = await getAuthenticatedUser(request)

    if (!user.email) {
      throw new Error('The authenticated user does not have an email address.')
    }

    const adminClient = createAdminClient()
    const { data, error } = await adminClient.rpc('claim_pending_workspace_invites', {
      p_user_id: user.id,
      p_email: user.email
    })

    if (error) {
      throw error
    }

    return jsonResponse({
      claimedCount: Number(data || 0)
    })
  } catch (error) {
    logger.error('Failed to claim pending workspace invites.', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to claim pending workspace invites.'
      },
      400
    )
  }
})
