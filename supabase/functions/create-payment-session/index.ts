import { z } from 'npm:zod@4.3.6'
import { createMonobankInvoiceRequest, requestMonobankInvoice } from '../_shared/monobank.ts'
import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient, ensureProfileRecord, getAuthenticatedUser } from '../_shared/supabase.ts'

const logger = createLogger('create-payment-session')

const requestSchema = z.object({
  planType: z.enum(['personal', 'team'])
})

type WorkspacePlanType = z.infer<typeof requestSchema>['planType']

interface OwnedWorkspaceRecord {
  id: string
  name: string
  type: WorkspacePlanType
  status: 'pending_payment' | 'active' | 'archived'
}

const WORKSPACE_PLAN_CONFIG = {
  personal: {
    amountMinor: 100,
    currency: 'UAH',
    orderDescription: 'Solo workspace activation'
  },
  team: {
    amountMinor: 200,
    currency: 'UAH',
    orderDescription: 'Corporate workspace activation'
  }
} as const
const WORKSPACE_PAYMENT_FINAL_TIMEOUT_MS = 180_000

const getRequiredEnv = (name: string) => {
  const value = Deno.env.get(name)

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}.`)
  }

  return value
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const resolveAppBaseUrl = (request: Request) => {
  try {
    const configuredBaseUrl = Deno.env.get('APP_BASE_URL')

    if (configuredBaseUrl) {
      return trimTrailingSlash(configuredBaseUrl)
    }

    const requestOrigin = request.headers.get('origin') || request.headers.get('referer')

    if (!requestOrigin) {
      throw new Error('Missing required environment variable: APP_BASE_URL.')
    }

    return trimTrailingSlash(new URL(requestOrigin).origin)
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to resolve the application base URL.')
  }
}

const buildWorkspaceName = ({
  planType,
  fullName,
  email
}: {
  planType: 'personal' | 'team'
  fullName?: string | null
  email?: string | null
}) => {
  const workspacePrefix = fullName?.trim() || email?.split('@')[0] || 'Creative Studio'
  return planType === 'personal' ? `${workspacePrefix} workspace` : `${workspacePrefix} corporate workspace`
}

const getOwnedWorkspaceByPlanType = (
  workspaces: OwnedWorkspaceRecord[],
  planType: WorkspacePlanType
) =>
  workspaces.filter((workspace) => workspace.type === planType).sort((leftWorkspace, rightWorkspace) => {
    const leftStatusRank = leftWorkspace.status === 'active' ? 0 : leftWorkspace.status === 'pending_payment' ? 1 : 2
    const rightStatusRank = rightWorkspace.status === 'active' ? 0 : rightWorkspace.status === 'pending_payment' ? 1 : 2

    if (leftStatusRank !== rightStatusRank) {
      return leftStatusRank - rightStatusRank
    }

    return leftWorkspace.name.localeCompare(rightWorkspace.name)
  })[0] ?? null

const resolveWorkspaceCheckoutConflict = ({
  planType,
  ownedWorkspace
}: {
  planType: WorkspacePlanType
  ownedWorkspace: OwnedWorkspaceRecord | null
}) => {
  if (!ownedWorkspace) {
    return null
  }

  if (ownedWorkspace.type === 'team' && planType === 'team') {
    return {
      status: 409,
      message: 'You already have an active corporate workspace.'
    }
  }

  if (ownedWorkspace.type === 'personal' && planType === 'personal') {
    return {
      status: 409,
      message: 'You already have an active solo workspace.'
    }
  }

  return null
}

const isPaymentRecordExpired = (createdAt: unknown, now = Date.now()) => {
  try {
    if (typeof createdAt !== 'string' || !createdAt.trim()) {
      return false
    }

    const createdTimestamp = Date.parse(createdAt)

    if (Number.isNaN(createdTimestamp)) {
      return false
    }

    return now - createdTimestamp >= WORKSPACE_PAYMENT_FINAL_TIMEOUT_MS
  } catch (error) {
    return false
  }
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptionsRequest(request)
  if (optionsResponse) {
    return optionsResponse
  }

  let insertedPaymentId: string | null = null
  let pendingProviderReference: string | null = null

  try {
    const parsedRequest = requestSchema.parse(await request.json())
    const user = await getAuthenticatedUser(request)
    const adminClient = createAdminClient()

    const [profile, existingOwnedWorkspacesResult, existingPaymentResult] = await Promise.all([
      ensureProfileRecord({
        adminClient,
        user
      }),
      adminClient
        .from('workspaces')
        .select('id, name, type, status')
        .eq('owner_user_id', user.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: true }),
      adminClient
        .from('workspace_payments')
        .select('id, provider_order_id, checkout_url, raw_request, created_at')
        .eq('user_id', user.id)
        .eq('plan_type', parsedRequest.planType)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    if (existingOwnedWorkspacesResult.error) {
      throw existingOwnedWorkspacesResult.error
    }

    if (existingPaymentResult.error) {
      throw existingPaymentResult.error
    }

    const ownedWorkspaces = (existingOwnedWorkspacesResult.data || []) as OwnedWorkspaceRecord[]
    const ownedWorkspace = getOwnedWorkspaceByPlanType(ownedWorkspaces, parsedRequest.planType)
    const checkoutConflict = resolveWorkspaceCheckoutConflict({
      planType: parsedRequest.planType,
      ownedWorkspace
    })

    if (checkoutConflict) {
      return jsonResponse(
        {
          error: checkoutConflict.message
        },
        checkoutConflict.status
      )
    }

    const existingPendingPayment = existingPaymentResult.data
    const isExistingPendingPaymentExpired = isPaymentRecordExpired(existingPendingPayment?.created_at)

    if (existingPendingPayment?.id && isExistingPendingPaymentExpired) {
      const { error: expirePaymentError } = await adminClient
        .from('workspace_payments')
        .update({
          status: 'failed',
          raw_response: {
            expiredReason: 'Payment was not confirmed within 3 minutes.',
            expiredAt: new Date().toISOString()
          }
        })
        .eq('id', existingPendingPayment.id)
        .in('status', ['pending', 'processing'])

      if (expirePaymentError) {
        throw expirePaymentError
      }
    }

    const existingRawRequest = !isExistingPendingPaymentExpired ? existingPendingPayment?.raw_request : null
    const existingMonobankCheckout =
      typeof existingPendingPayment?.checkout_url === 'string' &&
      existingPendingPayment.checkout_url.length > 0 &&
      !!existingRawRequest &&
      typeof existingRawRequest === 'object' &&
      'webHookUrl' in existingRawRequest

    if (existingMonobankCheckout) {
      return jsonResponse({
        checkoutUrl: existingPendingPayment.checkout_url,
        orderId: existingPendingPayment.provider_order_id,
        paymentId: existingPendingPayment.id
      })
    }

    const monobankToken = getRequiredEnv('MONOBANK_TOKEN')
    const appBaseUrl = resolveAppBaseUrl(request)
    const monobankApiBaseUrl = Deno.env.get('MONOBANK_API_BASE_URL') || undefined
    const callbackUrl = `${trimTrailingSlash(getRequiredEnv('SUPABASE_URL'))}/functions/v1/payment-callback`
    const workspacePlan = WORKSPACE_PLAN_CONFIG[parsedRequest.planType]
    const upgradeTargetWorkspace = null
    const workspaceName =
      upgradeTargetWorkspace?.name ||
      buildWorkspaceName({
        planType: parsedRequest.planType,
        fullName: profile.full_name,
        email: profile.email || user.email
      })
    pendingProviderReference = `workspace-${parsedRequest.planType}-${Date.now()}-${crypto.randomUUID()}`

    const { data: insertedPayment, error: insertPaymentError } = await adminClient
      .from('workspace_payments')
      .insert({
        user_id: user.id,
        workspace_id: upgradeTargetWorkspace?.id ?? null,
        workspace_name: workspaceName,
        plan_type: parsedRequest.planType,
        amount_minor: workspacePlan.amountMinor,
        currency: workspacePlan.currency,
        provider: 'monobank',
        provider_order_id: pendingProviderReference,
        status: 'pending',
        raw_request: {}
      })
      .select('id')
      .single()

    if (insertPaymentError) {
      throw insertPaymentError
    }

    insertedPaymentId = insertedPayment.id

    const monobankRequest = createMonobankInvoiceRequest({
      amountMinor: workspacePlan.amountMinor,
      currency: workspacePlan.currency,
      redirectUrl: `${appBaseUrl}?workspaceCheckout=return`,
      webhookUrl: callbackUrl,
      reference: pendingProviderReference,
      destination: workspacePlan.orderDescription,
      comment: workspaceName,
      customerEmail: profile.email || user.email || null
    })

    const { invoiceId, checkoutUrl, rawResponse } = await requestMonobankInvoice({
      token: monobankToken,
      payload: monobankRequest,
      baseUrl: monobankApiBaseUrl
    })

    const { error: updatePaymentError } = await adminClient
      .from('workspace_payments')
      .update({
        provider_order_id: invoiceId,
        status: 'processing',
        checkout_url: checkoutUrl,
        raw_request: monobankRequest,
        raw_response: rawResponse
      })
      .eq('id', insertedPayment.id)

    if (updatePaymentError) {
      throw updatePaymentError
    }

    return jsonResponse({
      checkoutUrl,
      orderId: invoiceId,
      paymentId: insertedPayment.id
    })
  } catch (error) {
    if (insertedPaymentId) {
      try {
        const adminClient = createAdminClient()
        const errorPayload = {
          error: error instanceof Error ? error.message : 'Unknown Monobank session error.',
          failedAt: new Date().toISOString(),
          pendingProviderReference
        }

        const { error: rollbackError } = await adminClient
          .from('workspace_payments')
          .update({
            status: 'failed',
            raw_response: errorPayload
          })
          .eq('id', insertedPaymentId)

        if (rollbackError) {
          logger.warn('Failed to persist the Monobank payment creation failure state.', {
            insertedPaymentId,
            rollbackError
          })
        }
      } catch (rollbackError) {
        logger.warn('Failed to run Monobank payment failure cleanup.', {
          insertedPaymentId,
          rollbackError
        })
      }
    }

    logger.error('Failed to create a workspace payment session.', {
      error,
      insertedPaymentId,
      pendingProviderReference
    })
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to create the workspace payment session.'
      },
      400
    )
  }
})
