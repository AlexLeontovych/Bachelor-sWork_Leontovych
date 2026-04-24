import { withRetry } from './retry.ts'

export type MonobankInvoiceStatus =
  | 'created'
  | 'processing'
  | 'hold'
  | 'success'
  | 'failure'
  | 'reversed'
  | 'expired'
  | string

export type WorkspacePaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled'

const MONOBANK_API_BASE_URL = 'https://api.monobank.ua'
const MONOBANK_CURRENCY_NUMERIC_CODES: Record<string, number> = {
  UAH: 980
}

let cachedPublicKeySource: string | null = null
let cachedPublicKey: CryptoKey | null = null

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const getMonobankApiBaseUrl = (baseUrl?: string) =>
  trimTrailingSlash(baseUrl?.trim() || MONOBANK_API_BASE_URL)

const decodeBase64ToBytes = (value: string): Uint8Array => {
  const normalizedValue = value.replace(/\s+/g, '')
  return Uint8Array.from(atob(normalizedValue), (character) => character.charCodeAt(0))
}

const decodeBase64ToString = (value: string): string =>
  new TextDecoder().decode(decodeBase64ToBytes(value))

const toArrayBuffer = (value: Uint8Array): ArrayBuffer => new Uint8Array(value).buffer

const readAsn1Length = (
  input: Uint8Array,
  offset: number
): {
  length: number
  nextOffset: number
} => {
  const firstLengthByte = input[offset]

  if (firstLengthByte === undefined) {
    throw new Error('The Monobank signature is missing an ASN.1 length byte.')
  }

  if ((firstLengthByte & 0x80) === 0) {
    return {
      length: firstLengthByte,
      nextOffset: offset + 1
    }
  }

  const byteCount = firstLengthByte & 0x7f

  if (byteCount === 0 || byteCount > 4) {
    throw new Error('The Monobank signature uses an unsupported ASN.1 length format.')
  }

  let length = 0

  for (let index = 0; index < byteCount; index += 1) {
    const nextByte = input[offset + 1 + index]

    if (nextByte === undefined) {
      throw new Error('The Monobank signature ended before the ASN.1 length could be read.')
    }

    length = (length << 8) | nextByte
  }

  return {
    length,
    nextOffset: offset + 1 + byteCount
  }
}

const normalizeIntegerBytes = (input: Uint8Array, size: number): Uint8Array => {
  let normalizedInput = input

  while (normalizedInput.length > 0 && normalizedInput[0] === 0) {
    normalizedInput = normalizedInput.slice(1)
  }

  if (normalizedInput.length > size) {
    throw new Error('The Monobank signature integer exceeds the expected ECDSA size.')
  }

  const output = new Uint8Array(size)
  output.set(normalizedInput, size - normalizedInput.length)
  return output
}

const convertDerEcdsaSignatureToRaw = (input: Uint8Array): Uint8Array => {
  if (input.length === 64) {
    return input
  }

  if (input[0] !== 0x30) {
    throw new Error('The Monobank signature is not a DER-encoded ASN.1 sequence.')
  }

  const sequenceLengthResult = readAsn1Length(input, 1)
  let cursor = sequenceLengthResult.nextOffset

  if (cursor + sequenceLengthResult.length > input.length) {
    throw new Error('The Monobank signature sequence length is invalid.')
  }

  if (input[cursor] !== 0x02) {
    throw new Error('The Monobank signature is missing the first ASN.1 integer.')
  }

  const rLengthResult = readAsn1Length(input, cursor + 1)
  const rValueStart = rLengthResult.nextOffset
  const rValueEnd = rValueStart + rLengthResult.length
  const rValue = input.slice(rValueStart, rValueEnd)
  cursor = rValueEnd

  if (input[cursor] !== 0x02) {
    throw new Error('The Monobank signature is missing the second ASN.1 integer.')
  }

  const sLengthResult = readAsn1Length(input, cursor + 1)
  const sValueStart = sLengthResult.nextOffset
  const sValueEnd = sValueStart + sLengthResult.length
  const sValue = input.slice(sValueStart, sValueEnd)

  const rawSignature = new Uint8Array(64)
  rawSignature.set(normalizeIntegerBytes(rValue, 32), 0)
  rawSignature.set(normalizeIntegerBytes(sValue, 32), 32)

  return rawSignature
}

const convertPemToSpkiBytes = (pem: string): Uint8Array => {
  const pemBody = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '')

  return decodeBase64ToBytes(pemBody)
}

const importMonobankPublicKey = async (publicKeyBase64: string): Promise<CryptoKey> => {
  if (cachedPublicKey && cachedPublicKeySource === publicKeyBase64) {
    return cachedPublicKey
  }

  const publicKeyPem = decodeBase64ToString(publicKeyBase64)
  const publicKeyBytes = convertPemToSpkiBytes(publicKeyPem)
  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    toArrayBuffer(publicKeyBytes),
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false,
    ['verify']
  )

  cachedPublicKeySource = publicKeyBase64
  cachedPublicKey = cryptoKey
  return cryptoKey
}

const createMonobankHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  'X-Token': token
})

const resolveNumericCurrencyCode = (currency: string): number => {
  const numericCurrencyCode = MONOBANK_CURRENCY_NUMERIC_CODES[currency.toUpperCase()]

  if (!numericCurrencyCode) {
    throw new Error(`Monobank does not support the configured currency: ${currency}.`)
  }

  return numericCurrencyCode
}

/**
 * Builds a Monobank hosted-invoice request payload for a workspace checkout.
 *
 * @param {{
 *   amountMinor: number
 *   currency: string
 *   redirectUrl: string
 *   webhookUrl: string
 *   reference: string
 *   destination: string
 *   comment?: string
 *   customerEmail?: string | null
 * }} input
 * @returns {Record<string, unknown>}
 *
 * @example
 * const payload = createMonobankInvoiceRequest({
 *   amountMinor: 100,
 *   currency: 'UAH',
 *   redirectUrl: 'https://app.example.com?workspaceCheckout=return',
 *   webhookUrl: 'https://project.supabase.co/functions/v1/payment-callback',
 *   reference: 'workspace-team-1',
 *   destination: 'Team workspace activation'
 * })
 */
export const createMonobankInvoiceRequest = (input: {
  amountMinor: number
  currency: string
  redirectUrl: string
  webhookUrl: string
  reference: string
  destination: string
  comment?: string
  customerEmail?: string | null
}): Record<string, unknown> => {
  try {
    return {
      amount: input.amountMinor,
      ccy: resolveNumericCurrencyCode(input.currency),
      redirectUrl: input.redirectUrl,
      webHookUrl: input.webhookUrl,
      paymentType: 'debit',
      validity: 3600,
      merchantPaymInfo: {
        reference: input.reference,
        destination: input.destination,
        comment: input.comment || input.destination,
        ...(input.customerEmail ? { customerEmails: [input.customerEmail] } : {})
      }
    }
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('Unable to build the Monobank invoice request payload.')
  }
}

/**
 * Creates a hosted Monobank invoice and returns the redirect URL plus raw provider response.
 *
 * @param {{
 *   token: string
 *   payload: Record<string, unknown>
 *   baseUrl?: string
 * }} input
 * @returns {Promise<{ invoiceId: string; checkoutUrl: string; rawResponse: Record<string, unknown> }>}
 *
 * @example
 * const invoice = await requestMonobankInvoice({
 *   token: Deno.env.get('MONOBANK_TOKEN')!,
 *   payload
 * })
 */
export const requestMonobankInvoice = async ({
  token,
  payload,
  baseUrl
}: {
  token: string
  payload: Record<string, unknown>
  baseUrl?: string
}): Promise<{ invoiceId: string; checkoutUrl: string; rawResponse: Record<string, unknown> }> => {
  try {
    return await withRetry(async () => {
      const response = await fetch(`${getMonobankApiBaseUrl(baseUrl)}/api/merchant/invoice/create`, {
        method: 'POST',
        headers: createMonobankHeaders(token),
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Monobank invoice creation failed with HTTP ${response.status}.`)
      }

      const body = (await response.json()) as Record<string, unknown>
      const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : ''
      const checkoutUrl = typeof body.pageUrl === 'string' ? body.pageUrl : ''

      if (!invoiceId || !checkoutUrl) {
        throw new Error('Monobank did not return a valid invoice identifier and hosted checkout URL.')
      }

      return {
        invoiceId,
        checkoutUrl,
        rawResponse: body
      }
    })
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to create the Monobank invoice.')
  }
}

/**
 * Fetches the current Monobank merchant public key for webhook signature verification.
 *
 * @param {{ token: string; baseUrl?: string }} input
 * @returns {Promise<string>}
 *
 * @example
 * const publicKey = await requestMonobankPublicKey({
 *   token: Deno.env.get('MONOBANK_TOKEN')!
 * })
 */
export const requestMonobankPublicKey = async ({
  token,
  baseUrl
}: {
  token: string
  baseUrl?: string
}): Promise<string> => {
  try {
    return await withRetry(async () => {
      const response = await fetch(`${getMonobankApiBaseUrl(baseUrl)}/api/merchant/pubkey`, {
        method: 'GET',
        headers: {
          'X-Token': token
        }
      })

      if (!response.ok) {
        throw new Error(`Monobank public key request failed with HTTP ${response.status}.`)
      }

      const body = (await response.json()) as Record<string, unknown>
      const publicKey = typeof body.key === 'string' ? body.key : ''

      if (!publicKey) {
        throw new Error('Monobank did not return a public key for webhook verification.')
      }

      return publicKey
    })
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to load the Monobank webhook public key.')
  }
}

/**
 * Verifies a Monobank webhook signature using the merchant public key returned by `/api/merchant/pubkey`.
 *
 * @param {{
 *   body: string
 *   signature: string
 *   publicKeyBase64: string
 * }} input
 * @returns {Promise<boolean>}
 *
 * @example
 * const isValid = await verifyMonobankWebhookSignature({
 *   body: rawBody,
 *   signature: request.headers.get('X-Sign') || '',
 *   publicKeyBase64
 * })
 */
export const verifyMonobankWebhookSignature = async ({
  body,
  signature,
  publicKeyBase64
}: {
  body: string
  signature: string
  publicKeyBase64: string
}): Promise<boolean> => {
  try {
    if (!signature.trim() || !body.trim() || !publicKeyBase64.trim()) {
      return false
    }

    const publicKey = await importMonobankPublicKey(publicKeyBase64)
    let signatureBytes: Uint8Array

    try {
      signatureBytes = convertDerEcdsaSignatureToRaw(decodeBase64ToBytes(signature))
    } catch (error) {
      return false
    }

    return await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-256'
      },
      publicKey,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(new TextEncoder().encode(body))
    )
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('Unable to verify the Monobank webhook signature.')
  }
}

/**
 * Maps a Monobank invoice status to the internal workspace payment status model.
 *
 * @param {MonobankInvoiceStatus} status
 * @returns {WorkspacePaymentStatus}
 *
 * @example
 * const paymentStatus = mapMonobankInvoiceStatus('success')
 */
export const mapMonobankInvoiceStatus = (status: MonobankInvoiceStatus): WorkspacePaymentStatus => {
  try {
    switch (status) {
      case 'success':
        return 'paid'
      case 'failure':
        return 'failed'
      case 'expired':
      case 'reversed':
        return 'cancelled'
      case 'created':
      case 'processing':
      case 'hold':
        return 'processing'
      default:
        return 'pending'
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to map the Monobank invoice status.')
  }
}
