import { z } from 'npm:zod@4.3.6'
import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient } from '../_shared/supabase.ts'

const logger = createLogger('register-account')

const registerAccountRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(72),
  fullName: z.string().trim().max(120).optional().nullable()
})

const normalizeFullName = (value?: string | null) => {
  const normalizedValue = value?.trim()
  return normalizedValue ? normalizedValue : null
}

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unable to create the account.')

const mapRegistrationError = (error: unknown) => {
  const errorMessage = getErrorMessage(error).toLowerCase()

  if (errorMessage.includes('already') && errorMessage.includes('registered')) {
    return {
      status: 409,
      message: 'An account with this email already exists. Sign in instead.'
    }
  }

  if (errorMessage.includes('password')) {
    return {
      status: 400,
      message: getErrorMessage(error)
    }
  }

  if (errorMessage.includes('email')) {
    return {
      status: 400,
      message: getErrorMessage(error)
    }
  }

  return {
    status: 400,
    message: 'Unable to create the account right now. Please try again.'
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

  let createdUserId: string | null = null

  try {
    const parsedRequest = registerAccountRequestSchema.parse(await request.json())
    const normalizedFullName = normalizeFullName(parsedRequest.fullName)
    const adminClient = createAdminClient()
    const { data: createdUserResponse, error: createUserError } = await adminClient.auth.admin.createUser({
      email: parsedRequest.email,
      password: parsedRequest.password,
      email_confirm: true,
      user_metadata: normalizedFullName ? { full_name: normalizedFullName } : {}
    })

    if (createUserError) {
      throw createUserError
    }

    if (!createdUserResponse.user?.id) {
      throw new Error('Supabase Auth did not return the created user identifier.')
    }

    createdUserId = createdUserResponse.user.id

    const { error: upsertProfileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: createdUserResponse.user.id,
          email: createdUserResponse.user.email ?? parsedRequest.email,
          full_name: normalizedFullName,
          role: 'user',
          team_role: 'developer',
          banned: false
        },
        {
          onConflict: 'id'
        }
      )

    if (upsertProfileError) {
      throw upsertProfileError
    }

    return jsonResponse(
      {
        userId: createdUserResponse.user.id,
        email: createdUserResponse.user.email ?? parsedRequest.email
      },
      201
    )
  } catch (error) {
    if (createdUserId) {
      try {
        const adminClient = createAdminClient()
        const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(createdUserId)

        if (deleteUserError) {
          logger.warn('Failed to roll back a partially created account.', {
            createdUserId,
            deleteUserError
          })
        }
      } catch (rollbackError) {
        logger.warn('Failed to execute account creation rollback.', {
          createdUserId,
          rollbackError
        })
      }
    }

    const mappedError = mapRegistrationError(error)
    logger.error('Failed to register a new account.', {
      error,
      createdUserId
    })
    return jsonResponse({ error: mappedError.message }, mappedError.status)
  }
})
