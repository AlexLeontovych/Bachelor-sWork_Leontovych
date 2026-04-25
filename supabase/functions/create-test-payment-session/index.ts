import { z } from 'npm:zod@4.3.6'
import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient, ensureProfileRecord, getAuthenticatedUser } from '../_shared/supabase.ts'

const logger = createLogger('create-test-payment-session')

const requestSchema = z.object({
  planType: z.enum(['personal', 'team'])
})

type WorkspacePlanType = z.infer<typeof requestSchema>['planType']

const WORKSPACE_PLAN_CONFIG = {
  personal: {
    amountMinor: 100,
    currency: 'UAH'
  },
  team: {
    amountMinor: 200,
    currency: 'UAH'
  }
} as const

const isTestPaymentsEnabled = () => {
  try {
    const explicitFlag = Deno.env.get('ENABLE_TEST_PAYMENTS')
    const appEnvironment = Deno.env.get('APP_ENV') || Deno.env.get('ENVIRONMENT') || 'development'

    if (explicitFlag) {
      return explicitFlag === 'true'
    }

    return appEnvironment !== 'production'
  } catch (error) {
    return false
  }
}

const buildWorkspaceName = ({
  planType,
  fullName,
  email
}: {
  planType: WorkspacePlanType
  fullName?: string | null
  email?: string | null
}) => {
  const workspacePrefix = fullName?.trim() || email?.split('@')[0] || 'Creative Studio'
  return planType === 'personal' ? `${workspacePrefix} workspace` : `${workspacePrefix} corporate workspace`
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptionsRequest(request)
  if (optionsResponse) {
    return optionsResponse
  }

  try {
    if (!isTestPaymentsEnabled()) {
      return jsonResponse({ error: 'Test payments are disabled for this environment.' }, 403)
    }

    const parsedRequest = requestSchema.parse(await request.json())
    const user = await getAuthenticatedUser(request)
    const adminClient = createAdminClient()
    const profile = await ensureProfileRecord({
      adminClient,
      user
    })

    const { data: existingWorkspace, error: existingWorkspaceError } = await adminClient
      .from('workspaces')
      .select('id, type, status')
      .eq('owner_user_id', user.id)
      .eq('type', parsedRequest.planType)
      .neq('status', 'archived')
      .limit(1)
      .maybeSingle()

    if (existingWorkspaceError) {
      throw existingWorkspaceError
    }

    if (existingWorkspace?.id) {
      return jsonResponse(
        {
          error:
            parsedRequest.planType === 'team'
              ? 'You already have an active corporate workspace.'
              : 'You already have an active solo workspace.'
        },
        409
      )
    }

    const workspacePlan = WORKSPACE_PLAN_CONFIG[parsedRequest.planType]
    const workspaceName = buildWorkspaceName({
      planType: parsedRequest.planType,
      fullName: profile.full_name,
      email: profile.email || user.email
    })
    const providerOrderId = `test-workspace-${parsedRequest.planType}-${Date.now()}-${crypto.randomUUID()}`

    const { data: payment, error: insertPaymentError } = await adminClient
      .from('workspace_payments')
      .insert({
        user_id: user.id,
        workspace_id: null,
        workspace_name: workspaceName,
        plan_type: parsedRequest.planType,
        amount_minor: workspacePlan.amountMinor,
        currency: workspacePlan.currency,
        provider: 'monobank',
        provider_order_id: providerOrderId,
        provider_payment_id: providerOrderId,
        status: 'processing',
        checkout_url: null,
        raw_request: {
          testPayment: true
        }
      })
      .select('id')
      .single()

    if (insertPaymentError) {
      throw insertPaymentError
    }

    const { data: activatedWorkspaceId, error: activationError } = await adminClient.rpc('activate_workspace_payment', {
      p_payment_id: payment.id,
      p_provider_payment_id: providerOrderId,
      p_raw_response: {
        testPayment: true,
        status: 'paid',
        activatedAt: new Date().toISOString()
      }
    })

    if (activationError) {
      throw activationError
    }

    return jsonResponse({
      workspaceId: activatedWorkspaceId,
      orderId: providerOrderId,
      paymentId: payment.id
    })
  } catch (error) {
    logger.error('Failed to create a test workspace payment.', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to create the test payment.'
      },
      400
    )
  }
})
