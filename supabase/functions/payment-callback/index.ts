import { z } from 'npm:zod@4.3.6'
import {
  mapMonobankInvoiceStatus,
  requestMonobankPublicKey,
  verifyMonobankWebhookSignature
} from '../_shared/monobank.ts'
import { createLogger } from '../_shared/logger.ts'
import { jsonResponse, handleOptionsRequest } from '../_shared/responses.ts'
import { createAdminClient } from '../_shared/supabase.ts'

const logger = createLogger('payment-callback')
const WORKSPACE_PAYMENT_FINAL_TIMEOUT_MS = 180_000

const getRequiredEnv = (name: string) => {
  const value = Deno.env.get(name)

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}.`)
  }

  return value
}

const callbackPayloadSchema = z
  .object({
    invoiceId: z.string().min(1),
    status: z.string().min(1),
    modifiedDate: z.string().min(1).optional(),
    paymentInfo: z
      .object({
        tranId: z.union([z.string(), z.number()]).optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough()

type MonobankCallbackPayload = z.infer<typeof callbackPayloadSchema>

const parseCallbackPayload = (rawBody: string): MonobankCallbackPayload => {
  try {
    return callbackPayloadSchema.parse(JSON.parse(rawBody))
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('Unable to parse the Monobank webhook payload.')
  }
}

const toTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

const mergeRawResponse = (
  existingRawResponse: Record<string, unknown> | null | undefined,
  callbackPayload: MonobankCallbackPayload
) => {
  try {
    return {
      ...(existingRawResponse && typeof existingRawResponse === 'object' && !Array.isArray(existingRawResponse)
        ? existingRawResponse
        : {}),
      ...callbackPayload
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to merge the Monobank callback payload.')
  }
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
    throw error instanceof Error ? error : new Error('Unable to evaluate payment expiration.')
  }
}

const shouldIgnoreWebhookUpdate = ({
  currentStatus,
  incomingStatus,
  existingRawResponse,
  callbackPayload
}: {
  currentStatus: string
  incomingStatus: string
  existingRawResponse: Record<string, unknown> | null | undefined
  callbackPayload: MonobankCallbackPayload
}) => {
  try {
    const existingModifiedAt = toTimestamp(existingRawResponse?.modifiedDate)
    const incomingModifiedAt = toTimestamp(callbackPayload.modifiedDate)

    if (existingModifiedAt !== null && incomingModifiedAt !== null && incomingModifiedAt < existingModifiedAt) {
      return true
    }

    if (currentStatus === 'paid' && incomingStatus !== 'paid') {
      return true
    }

    if (
      (currentStatus === 'failed' || currentStatus === 'cancelled') &&
      (incomingStatus === 'pending' || incomingStatus === 'processing')
    ) {
      return true
    }

    return false
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to evaluate Monobank webhook ordering.')
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

  try {
    const rawBody = await request.text()
    const signature = request.headers.get('X-Sign') || ''
    const monobankToken = getRequiredEnv('MONOBANK_TOKEN')
    const monobankApiBaseUrl = Deno.env.get('MONOBANK_API_BASE_URL') || undefined
    const publicKeyBase64 = await requestMonobankPublicKey({
      token: monobankToken,
      baseUrl: monobankApiBaseUrl
    })
    const isValidSignature = await verifyMonobankWebhookSignature({
      body: rawBody,
      signature,
      publicKeyBase64
    })

    if (!isValidSignature) {
      logger.warn('Rejected payment callback because the Monobank signature was invalid.', {
        signaturePresent: Boolean(signature),
        bodyLength: rawBody.length
      })
      return jsonResponse({ error: 'Invalid payment callback signature.' }, 400)
    }

    const callbackPayload = parseCallbackPayload(rawBody)
    const orderId = callbackPayload.invoiceId
    const providerPaymentId = callbackPayload.paymentInfo?.tranId
      ? String(callbackPayload.paymentInfo.tranId)
      : null
    const mappedStatus = mapMonobankInvoiceStatus(callbackPayload.status)
    const adminClient = createAdminClient()

    const { data: paymentRecord, error: paymentLookupError } = await adminClient
      .from('workspace_payments')
      .select('id, status, raw_response, created_at')
      .eq('provider_order_id', orderId)
      .maybeSingle()

    if (paymentLookupError) {
      throw paymentLookupError
    }

    if (!paymentRecord?.id) {
      logger.warn('Received callback for an unknown payment order.', { orderId, callbackPayload })
      return jsonResponse({ response: 'accept' })
    }

    const mergedRawResponse = mergeRawResponse(paymentRecord.raw_response, callbackPayload)

    if (
      shouldIgnoreWebhookUpdate({
        currentStatus: paymentRecord.status,
        incomingStatus: mappedStatus,
        existingRawResponse:
          paymentRecord.raw_response && typeof paymentRecord.raw_response === 'object' && !Array.isArray(paymentRecord.raw_response)
            ? paymentRecord.raw_response
            : null,
        callbackPayload
      })
    ) {
      logger.info('Ignored an out-of-order Monobank webhook update.', {
        orderId,
        currentStatus: paymentRecord.status,
        incomingStatus: mappedStatus,
        modifiedDate: callbackPayload.modifiedDate ?? null
      })
      return jsonResponse({ response: 'accept' })
    }

    if (mappedStatus !== 'paid') {
      const { error: updatePaymentError } = await adminClient
        .from('workspace_payments')
        .update({
          status: mappedStatus,
          provider_payment_id: providerPaymentId,
          raw_response: mergedRawResponse
        })
        .eq('id', paymentRecord.id)

      if (updatePaymentError) {
        throw updatePaymentError
      }

      return jsonResponse({ response: 'accept' })
    }

    if (isPaymentRecordExpired(paymentRecord.created_at)) {
      const { error: expirePaymentError } = await adminClient
        .from('workspace_payments')
        .update({
          status: 'failed',
          provider_payment_id: providerPaymentId,
          raw_response: {
            ...mergedRawResponse,
            expiredReason: 'Paid callback arrived after the 3 minute confirmation window.',
            expiredAt: new Date().toISOString()
          }
        })
        .eq('id', paymentRecord.id)
        .neq('status', 'paid')

      if (expirePaymentError) {
        throw expirePaymentError
      }

      logger.warn('Rejected a paid Monobank callback because it arrived after the confirmation window.', {
        orderId,
        createdAt: paymentRecord.created_at
      })

      return jsonResponse({ response: 'accept' })
    }

    const { error: activationError } = await adminClient.rpc('activate_workspace_payment', {
      p_payment_id: paymentRecord.id,
      p_provider_payment_id: providerPaymentId,
      p_raw_response: mergedRawResponse
    })

    if (activationError) {
      throw activationError
    }

    return jsonResponse({ response: 'accept' })
  } catch (error) {
    logger.error('Failed to handle the payment callback.', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to process the payment callback.'
      },
      400
    )
  }
})
