import { z } from 'zod'

export const workspaceJoinLoginSchema = z
  .string()
  .trim()
  .min(3, 'Workspace login must contain at least 3 characters.')
  .max(80, 'Workspace login is too long.')

export const workspaceJoinPasswordSchema = z
  .string()
  .min(8, 'Workspace password must contain at least 8 characters.')
  .max(160, 'Workspace password is too long.')

/**
 * Normalizes a workspace login so joins remain case-insensitive.
 *
 * @param {string} workspaceLogin
 * @returns {string}
 *
 * @example
 * const login = normalizeWorkspaceJoinLogin(' Team-Alpha ')
 */
export const normalizeWorkspaceJoinLogin = (workspaceLogin: string) => workspaceJoinLoginSchema.parse(workspaceLogin).toLowerCase()

/**
 * Validates the workspace credential pair before an authenticated join attempt.
 *
 * @param {{ workspaceLogin: string, workspacePassword: string }} input
 * @returns {{ workspaceLogin: string, workspacePassword: string }}
 *
 * @example
 * const payload = validateWorkspaceJoinRequest({ workspaceLogin: 'team-alpha', workspacePassword: 'Secret123!' })
 */
export const validateWorkspaceJoinRequest = ({
  workspaceLogin,
  workspacePassword
}: {
  workspaceLogin: string
  workspacePassword: string
}) => ({
  workspaceLogin: normalizeWorkspaceJoinLogin(workspaceLogin),
  workspacePassword: workspaceJoinPasswordSchema.parse(workspacePassword)
})
