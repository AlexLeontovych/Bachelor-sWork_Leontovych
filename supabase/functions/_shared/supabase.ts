import { createClient, type User } from 'npm:@supabase/supabase-js@2.86.2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing required Supabase Edge Function environment variables.')
}

export const createAdminClient = () =>
  createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })

const readNonEmptyString = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

const resolveProfileFullName = (user: User) => {
  const metadata =
    user.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}

  return (
    readNonEmptyString(metadata.full_name) ??
    readNonEmptyString(metadata.fullName) ??
    readNonEmptyString(metadata.name)
  )
}

const resolveProfileEmail = (user: User) => {
  const normalizedEmail = readNonEmptyString(user.email)
  return normalizedEmail ? normalizedEmail.toLowerCase() : null
}

export const ensureProfileRecord = async ({
  adminClient,
  user
}: {
  adminClient: ReturnType<typeof createAdminClient>
  user: User
}) => {
  try {
    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from('profiles')
      .select('id, email, full_name, role, team_role, banned')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfileError) {
      throw existingProfileError
    }

    if (existingProfile?.id) {
      return existingProfile
    }

    const restoredEmail = resolveProfileEmail(user)

    if (!restoredEmail) {
      throw new Error('The authenticated user does not have an email address required to restore the profile.')
    }

    const { data: restoredProfile, error: restoredProfileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: restoredEmail,
          full_name: resolveProfileFullName(user),
          role: 'user',
          team_role: 'developer',
          banned: false
        },
        {
          onConflict: 'id'
        }
      )
      .select('id, email, full_name, role, team_role, banned')
      .single()

    if (restoredProfileError) {
      throw restoredProfileError
    }

    return restoredProfile
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to ensure the authenticated profile record.')
  }
}

export const getAuthenticatedUser = async (request: Request) => {
  const authorizationHeader = request.headers.get('Authorization')

  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Bearer authorization header.')
  }

  const accessToken = authorizationHeader.replace(/^Bearer\s+/i, '')
  const adminClient = createAdminClient()
  const {
    data: { user },
    error
  } = await adminClient.auth.getUser(accessToken)

  if (error) {
    throw error
  }

  if (!user) {
    throw new Error('Unable to resolve the authenticated user.')
  }

  return user
}
