import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { mapMonobankInvoiceStatus, verifyMonobankWebhookSignature } from '../monobank'

const createEncodedPublicKey = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1'
  })

  return {
    privateKey,
    encodedPublicKey: Buffer.from(publicKey.export({ type: 'spki', format: 'pem' }).toString(), 'utf8').toString(
      'base64'
    )
  }
}

const createSignature = (body: string, privateKey: Parameters<typeof sign>[2]) =>
  sign('sha256', Buffer.from(body, 'utf8'), privateKey).toString('base64')

describe('monobank helper', () => {
  it('maps Monobank invoice states into the workspace payment lifecycle', () => {
    expect(mapMonobankInvoiceStatus('created')).toBe('processing')
    expect(mapMonobankInvoiceStatus('processing')).toBe('processing')
    expect(mapMonobankInvoiceStatus('hold')).toBe('processing')
    expect(mapMonobankInvoiceStatus('success')).toBe('paid')
    expect(mapMonobankInvoiceStatus('failure')).toBe('failed')
    expect(mapMonobankInvoiceStatus('expired')).toBe('cancelled')
    expect(mapMonobankInvoiceStatus('reversed')).toBe('cancelled')
    expect(mapMonobankInvoiceStatus('unknown-status')).toBe('pending')
  })

  it('accepts a valid Monobank webhook signature', async () => {
    const body = JSON.stringify({
      invoiceId: 'invoice-1',
      status: 'success',
      modifiedDate: '2026-04-17T12:00:00.000Z'
    })
    const { privateKey, encodedPublicKey } = createEncodedPublicKey()
    const signature = createSignature(body, privateKey)

    await expect(
      verifyMonobankWebhookSignature({
        body,
        signature,
        publicKeyBase64: encodedPublicKey
      })
    ).resolves.toBe(true)
  })

  it('rejects an invalid Monobank webhook signature', async () => {
    const body = JSON.stringify({
      invoiceId: 'invoice-2',
      status: 'processing',
      modifiedDate: '2026-04-17T12:05:00.000Z'
    })
    const { encodedPublicKey } = createEncodedPublicKey()

    await expect(
      verifyMonobankWebhookSignature({
        body,
        signature: Buffer.from('invalid-signature', 'utf8').toString('base64'),
        publicKeyBase64: encodedPublicKey
      })
    ).resolves.toBe(false)
  })
})
