import type { PostAuthDestination, WorkspaceAccess, WorkspacePaymentStatus, WorkspacePlanType } from './types'

export const ACTIVE_WORKSPACE_STORAGE_KEY = 'creative-studio.active-workspace-id'
export const PENDING_PAYMENT_ORDER_STORAGE_KEY = 'creative-studio.pending-payment-order-id'
export const PENDING_PAYMENT_STARTED_AT_STORAGE_KEY = 'creative-studio.pending-payment-started-at'
export const WORKSPACE_PAYMENT_CONFIRMATION_TIMEOUT_MS = 60_000

/**
 * Safely reads the last active workspace identifier from local storage.
 *
 * @returns {string | null}
 *
 * @example
 * const workspaceId = getStoredActiveWorkspaceId()
 */
export const getStoredActiveWorkspaceId = (): string | null => {
  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)
  } catch (error) {
    return null
  }
}

/**
 * Persists the active workspace identifier in local storage.
 *
 * @param {string | null} workspaceId
 * @returns {void}
 *
 * @example
 * storeActiveWorkspaceId('workspace-1')
 */
export const storeActiveWorkspaceId = (workspaceId: string | null): void => {
  try {
    if (!workspaceId) {
      window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId)
  } catch (error) {
    // Intentionally ignored because storage access can fail in private browsing modes.
  }
}

/**
 * Safely reads the pending checkout order identifier from local storage.
 *
 * @returns {string | null}
 *
 * @example
 * const orderId = getStoredPendingPaymentOrderId()
 */
export const getStoredPendingPaymentOrderId = (): string | null => {
  try {
    return window.localStorage.getItem(PENDING_PAYMENT_ORDER_STORAGE_KEY)
  } catch (error) {
    return null
  }
}

/**
 * Persists or clears the pending checkout order identifier.
 *
 * @param {string | null} orderId
 * @returns {void}
 *
 * @example
 * storePendingPaymentOrderId('monobank-invoice-1')
 */
export const storePendingPaymentOrderId = (orderId: string | null): void => {
  try {
    if (!orderId) {
      window.localStorage.removeItem(PENDING_PAYMENT_ORDER_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(PENDING_PAYMENT_ORDER_STORAGE_KEY, orderId)
  } catch (error) {
    // Ignore storage errors to avoid blocking checkout.
  }
}

/**
 * Reads the timestamp that marks when checkout confirmation waiting began.
 *
 * @returns {number | null}
 *
 * @example
 * const startedAt = getStoredPendingPaymentStartedAt()
 */
export const getStoredPendingPaymentStartedAt = (): number | null => {
  try {
    const storedValue = window.localStorage.getItem(PENDING_PAYMENT_STARTED_AT_STORAGE_KEY)

    if (!storedValue) {
      return null
    }

    const parsedValue = Number(storedValue)
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null
  } catch (error) {
    return null
  }
}

/**
 * Persists or clears the payment waiting start timestamp.
 *
 * @param {number | null} startedAt
 * @returns {void}
 *
 * @example
 * storePendingPaymentStartedAt(Date.now())
 */
export const storePendingPaymentStartedAt = (startedAt: number | null): void => {
  try {
    if (!startedAt || !Number.isFinite(startedAt) || startedAt <= 0) {
      window.localStorage.removeItem(PENDING_PAYMENT_STARTED_AT_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(PENDING_PAYMENT_STARTED_AT_STORAGE_KEY, String(startedAt))
  } catch (error) {
    // Ignore storage errors to avoid blocking checkout tracking.
  }
}

/**
 * Chooses the active workspace, preferring the stored identifier when available.
 *
 * @param {WorkspaceAccess[]} workspaces
 * @param {string | null | undefined} preferredWorkspaceId
 * @returns {WorkspaceAccess | null}
 *
 * @example
 * const activeWorkspace = selectDefaultWorkspaceAccess(workspaces, storedWorkspaceId)
 */
export const selectDefaultWorkspaceAccess = (
  workspaces: WorkspaceAccess[],
  preferredWorkspaceId?: string | null
): WorkspaceAccess | null => {
  try {
    if (!Array.isArray(workspaces) || workspaces.length === 0) {
      return null
    }

    if (preferredWorkspaceId) {
      const preferredWorkspace = workspaces.find((workspace) => workspace.workspaceId === preferredWorkspaceId)
      if (preferredWorkspace) {
        return preferredWorkspace
      }
    }

    const ownerWorkspace = workspaces.find((workspace) => workspace.workspaceRole === 'owner')
    return ownerWorkspace || workspaces[0] || null
  } catch (error) {
    return null
  }
}

/**
 * Decides whether the signed-in user should land in projects or onboarding.
 *
 * @param {{ workspaces: WorkspaceAccess[], preferredWorkspaceId?: string | null }} input
 * @returns {PostAuthDestination}
 *
 * @example
 * const destination = resolvePostAuthDestination({ workspaces, preferredWorkspaceId })
 */
export const resolvePostAuthDestination = ({
  workspaces,
  preferredWorkspaceId
}: {
  workspaces: WorkspaceAccess[]
  preferredWorkspaceId?: string | null
}): PostAuthDestination => {
  const activeWorkspace = selectDefaultWorkspaceAccess(workspaces, preferredWorkspaceId)

  if (!activeWorkspace) {
    return {
      nextView: 'onboarding',
      workspace: null
    }
  }

  return {
    nextView: 'projects',
    workspace: activeWorkspace
  }
}

/**
 * Decides whether workspace checkout can continue immediately or must be gated by authentication.
 *
 * @param {{ isGuest: boolean, hasUser: boolean, planType: WorkspacePlanType }} input
 * @returns {{ planType: WorkspacePlanType, requiresAuth: boolean }}
 *
 * @example
 * const checkoutAccess = resolveWorkspaceCheckoutAccess({ isGuest: true, hasUser: false, planType: 'team' })
 */
export const resolveWorkspaceCheckoutAccess = ({
  isGuest,
  hasUser,
  planType
}: {
  isGuest: boolean
  hasUser: boolean
  planType: WorkspacePlanType
}): { planType: WorkspacePlanType; requiresAuth: boolean } => {
  try {
    return {
      planType,
      requiresAuth: Boolean(isGuest || !hasUser)
    }
  } catch (error) {
    return {
      planType,
      requiresAuth: true
    }
  }
}

/**
 * Determines whether the current payment status represents a terminal checkout failure.
 *
 * @param {WorkspacePaymentStatus | null | undefined} status
 * @returns {boolean}
 *
 * @example
 * const isFailure = isWorkspacePaymentFailureStatus('cancelled')
 */
export const isWorkspacePaymentFailureStatus = (
  status?: WorkspacePaymentStatus | null
): status is Extract<WorkspacePaymentStatus, 'failed' | 'cancelled'> => {
  try {
    return status === 'failed' || status === 'cancelled'
  } catch (error) {
    return false
  }
}

/**
 * Calculates how many seconds remain before the checkout confirmation wait crosses the timeout threshold.
 *
 * @param {{ startedAt: number | null | undefined, now?: number }} input
 * @returns {number}
 *
 * @example
 * const secondsLeft = getWorkspacePaymentConfirmationRemainingSeconds({ startedAt: Date.now() })
 */
export const getWorkspacePaymentConfirmationRemainingSeconds = ({
  startedAt,
  now = Date.now()
}: {
  startedAt?: number | null
  now?: number
}): number => {
  try {
    if (!startedAt || !Number.isFinite(startedAt) || startedAt <= 0) {
      return Math.ceil(WORKSPACE_PAYMENT_CONFIRMATION_TIMEOUT_MS / 1000)
    }

    if (!Number.isFinite(now) || now <= 0) {
      return Math.ceil(WORKSPACE_PAYMENT_CONFIRMATION_TIMEOUT_MS / 1000)
    }

    return Math.max(0, Math.ceil((startedAt + WORKSPACE_PAYMENT_CONFIRMATION_TIMEOUT_MS - now) / 1000))
  } catch (error) {
    return Math.ceil(WORKSPACE_PAYMENT_CONFIRMATION_TIMEOUT_MS / 1000)
  }
}

/**
 * Reports whether the checkout confirmation wait exceeded the allowed timeout window.
 *
 * @param {{ startedAt: number | null | undefined, now?: number }} input
 * @returns {boolean}
 *
 * @example
 * const didTimeout = isWorkspacePaymentConfirmationDelayed({ startedAt: Date.now() - 61_000 })
 */
export const isWorkspacePaymentConfirmationDelayed = ({
  startedAt,
  now = Date.now()
}: {
  startedAt?: number | null
  now?: number
}): boolean => {
  try {
    if (!startedAt || !Number.isFinite(startedAt) || startedAt <= 0) {
      return false
    }

    if (!Number.isFinite(now) || now <= 0) {
      return false
    }

    return now - startedAt >= WORKSPACE_PAYMENT_CONFIRMATION_TIMEOUT_MS
  } catch (error) {
    return false
  }
}
