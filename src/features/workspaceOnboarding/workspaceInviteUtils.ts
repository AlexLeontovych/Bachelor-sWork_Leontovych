import { z } from 'zod'
import type { WorkspaceMember } from './types'

const inviteEmailSchema = z.string().trim().email()

/**
 * Normalizes an invite email so duplicate checks are case-insensitive.
 *
 * @param {string} email
 * @returns {string}
 *
 * @example
 * normalizeWorkspaceInviteEmail('Team@Example.com ')
 */
export const normalizeWorkspaceInviteEmail = (email: string): string => inviteEmailSchema.parse(email).toLowerCase()

/**
 * Validates whether an invite email can be added to the current workspace.
 *
 * @param {{ email: string, members: WorkspaceMember[] }} input
 * @returns {{ normalizedEmail: string }}
 *
 * @example
 * validateWorkspaceInviteCandidate({ email: 'dev@example.com', members })
 */
export const validateWorkspaceInviteCandidate = ({
  email,
  members
}: {
  email: string
  members: WorkspaceMember[]
}) => {
  const normalizedEmail = normalizeWorkspaceInviteEmail(email)

  if ((members || []).some((member) => member.email && normalizeWorkspaceInviteEmail(member.email) === normalizedEmail)) {
    throw new Error('This email already belongs to a workspace member.')
  }

  return {
    normalizedEmail
  }
}
