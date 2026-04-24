import type { WorkspacePlanType } from './types'

export const PENDING_WORKSPACE_ACTION_STORAGE_KEY = 'lumen.pendingWorkspaceAction'

const DEFAULT_PENDING_ACTION_TTL_MS = 30 * 60 * 1000

export type PendingWorkspaceAction =
  | {
      type: 'checkout'
      planType: WorkspacePlanType
      expiresAt: number
    }
  | {
      type: 'workspaceJoin'
      workspaceLogin: string
      workspacePassword: string
      expiresAt: number
    }

const isWorkspacePlanType = (value: unknown): value is WorkspacePlanType => value === 'personal' || value === 'team'

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

/**
 * Creates a short-lived pending checkout action that can resume after email confirmation.
 *
 * @param planType - Workspace plan selected before registration.
 * @param now - Current timestamp used for deterministic tests.
 * @returns Serializable pending checkout action.
 */
export const createPendingCheckoutAction = (
  planType: WorkspacePlanType,
  now = Date.now()
): PendingWorkspaceAction => ({
  type: 'checkout',
  planType,
  expiresAt: now + DEFAULT_PENDING_ACTION_TTL_MS
})

/**
 * Creates a short-lived pending workspace join action.
 *
 * @param input - Workspace credentials entered before registration.
 * @param now - Current timestamp used for deterministic tests.
 * @returns Serializable pending workspace join action.
 */
export const createPendingWorkspaceJoinAction = (
  input: { workspaceLogin: string; workspacePassword: string },
  now = Date.now()
): PendingWorkspaceAction => ({
  type: 'workspaceJoin',
  workspaceLogin: input.workspaceLogin.trim(),
  workspacePassword: input.workspacePassword,
  expiresAt: now + DEFAULT_PENDING_ACTION_TTL_MS
})

/**
 * Persists a pending action for the post-confirmation authentication flow.
 *
 * @param storage - Browser storage implementation.
 * @param action - Pending workspace action to persist.
 */
export const storePendingWorkspaceAction = (storage: Storage, action: PendingWorkspaceAction) => {
  storage.setItem(PENDING_WORKSPACE_ACTION_STORAGE_KEY, JSON.stringify(action))
}

/**
 * Clears the saved pending workspace action.
 *
 * @param storage - Browser storage implementation.
 */
export const clearPendingWorkspaceAction = (storage: Storage) => {
  storage.removeItem(PENDING_WORKSPACE_ACTION_STORAGE_KEY)
}

/**
 * Reads and validates the saved pending action, clearing invalid or expired values.
 *
 * @param storage - Browser storage implementation.
 * @param now - Current timestamp used for expiration checks.
 * @returns The pending action, or null when none can be safely resumed.
 */
export const getStoredPendingWorkspaceAction = (storage: Storage, now = Date.now()): PendingWorkspaceAction | null => {
  const rawAction = storage.getItem(PENDING_WORKSPACE_ACTION_STORAGE_KEY)

  if (!rawAction) {
    return null
  }

  try {
    const parsedAction = JSON.parse(rawAction) as Partial<PendingWorkspaceAction>

    if (typeof parsedAction.expiresAt !== 'number' || parsedAction.expiresAt <= now) {
      clearPendingWorkspaceAction(storage)
      return null
    }

    if (parsedAction.type === 'checkout' && isWorkspacePlanType(parsedAction.planType)) {
      return parsedAction as PendingWorkspaceAction
    }

    if (
      parsedAction.type === 'workspaceJoin' &&
      isNonEmptyString(parsedAction.workspaceLogin) &&
      isNonEmptyString(parsedAction.workspacePassword)
    ) {
      return parsedAction as PendingWorkspaceAction
    }
  } catch {
    clearPendingWorkspaceAction(storage)
    return null
  }

  clearPendingWorkspaceAction(storage)
  return null
}

