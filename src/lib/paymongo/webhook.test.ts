import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PaymentRecord } from '@/lib/orders/payments'
import { signPaymongoPayload } from './signature'
import { handlePaymongoWebhook, MAX_WEBHOOK_BYTES, type WebhookDeps } from './webhook'

const secret = 'whsk_test_secret'
const t = 1_760_000_000
type SessionAttrs = Record<string, unknown>
const event = (type = 'checkout_session.payment.paid', { id = 'cs_123' as unknown, livemode = false, attributes = {} as SessionAttrs } = {}) =>
  JSON.stringify({ data: { id: 'evt_1', type: 'event', attributes: { type, livemode, data: { id, type: 'checkout_session', attributes } } } })
const paidPayment = (amount: number, currency = 'PHP') => ({ id: 'pay_1', type: 'payment', attributes: { amount, currency, status: 'paid' } })

const record = (over: Partial<PaymentRecord> = {}): PaymentRecord => ({ orderId: 'order-1', outcome: 'paid', oversold: false, amountMismatch: false, newConflict: false, ...over })

function deps(r: PaymentRecord | (() => Promise<PaymentRecord>) = record(), over: Partial<WebhookDeps> = {}) {
  return {
    secret,
    expectedLivemode: false,
    recordPayment: vi.fn(typeof r === 'function' ? r : async () => r),
    sendConfirmation: vi.fn(async () => {}),
    notifyOwner: vi.fn(async () => {}),
    nowMs: () => t * 1000,
    ...over,
  }
}
const req = (rawBody: string, header: string | null = signPaymongoPayload(rawBody, secret, t)) => ({ rawBody, signatureHeader: header })

afterEach(() => vi.restoreAllMocks())

describe('handlePaymongoWebhook', () => {
  it('marks the order paid and sends one confirmation', async () => {
    const d = deps()
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r.status).toBe(200)
    expect(d.recordPayment).toHaveBeenCalledWith('cs_123', { paidCentavos: null, currency: null })
    expect(d.sendConfirmation).toHaveBeenCalledWith('order-1')
    expect(d.notifyOwner).not.toHaveBeenCalled()
  })
  it('passes the paid amount and currency from the session payments', async () => {
    const d = deps()
    await handlePaymongoWebhook(req(event(undefined, { attributes: { payments: [paidPayment(50000), paidPayment(15000)] } })), d)
    expect(d.recordPayment).toHaveBeenCalledWith('cs_123', { paidCentavos: 65000, currency: 'PHP' })
  })
  it('flags an amount mismatch loudly but still confirms the order', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps(record({ amountMismatch: true }))
    const r = await handlePaymongoWebhook(req(event(undefined, { attributes: { payments: [paidPayment(100)] } })), d)
    expect(r.status).toBe(200)
    expect(d.sendConfirmation).toHaveBeenCalledWith('order-1')
    expect(d.notifyOwner).toHaveBeenCalledWith('order-1', ['amount_mismatch'])
    expect(error).toHaveBeenCalledWith(expect.stringContaining('amount'), expect.anything())
  })
  it('emails the owner when a paid order turned out oversold', async () => {
    const d = deps(record({ oversold: true }))
    await handlePaymongoWebhook(req(event()), d)
    expect(d.notifyOwner).toHaveBeenCalledWith('order-1', ['oversold'])
  })
  it('re-tries the (at-most-once) confirmation when the order was already paid', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const d = deps(record({ outcome: 'already_paid' }))
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r).toEqual({ status: 200, body: { ignored: 'already paid', orderId: 'order-1' } })
    expect(d.sendConfirmation).toHaveBeenCalledWith('order-1')
    expect(d.notifyOwner).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalled()
  })
  it('flags a payment for a cancelled order, alerts the owner, and still answers 200', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps(record({ outcome: 'paid_after_cancel', newConflict: true }))
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r).toEqual({ status: 200, body: { conflict: 'paid_after_cancel', orderId: 'order-1' } })
    expect(d.sendConfirmation).not.toHaveBeenCalled()
    expect(d.notifyOwner).toHaveBeenCalledWith('order-1', ['paid_after_cancel'])
    expect(error).toHaveBeenCalledWith(expect.stringContaining('PAID AFTER CANCEL'), expect.anything())
  })
  it('alerts the owner about a paid-after-cancel only the first time it is flagged', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps(record({ outcome: 'paid_after_cancel', newConflict: false }))
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r.status).toBe(200)
    expect(d.notifyOwner).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('PAID AFTER CANCEL'), expect.anything())
  })
  it('logs an error for an unknown checkout session and answers 200', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps(record({ orderId: null, outcome: 'unknown' }))
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r).toEqual({ status: 200, body: { ignored: 'unknown checkout session' } })
    expect(d.sendConfirmation).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('unknown checkout'), expect.objectContaining({ checkoutId: 'cs_123' }))
  })
  it('rejects a bad signature without touching the database', async () => {
    const d = deps()
    const r = await handlePaymongoWebhook(req(event(), 't=1,te=deadbeef,li='), d)
    expect(r.status).toBe(401)
    expect(d.recordPayment).not.toHaveBeenCalled()
  })
  it('checks the signature before parsing the body', async () => {
    const parse = vi.spyOn(JSON, 'parse')
    const r = await handlePaymongoWebhook(req('{"a":1}', 't=1,te=deadbeef,li='), deps())
    expect(r.status).toBe(401)
    expect(parse).not.toHaveBeenCalled()
  })
  it('rejects a test-mode signature on a live event', async () => {
    const d = deps(undefined, { expectedLivemode: null })
    const r = await handlePaymongoWebhook(req(event(undefined, { livemode: true })), d)
    expect(r.status).toBe(401)
    expect(d.recordPayment).not.toHaveBeenCalled()
  })
  it('ignores an event from the other mode (test event on a live store)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps(undefined, { expectedLivemode: true })
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r).toEqual({ status: 200, body: { ignored: 'livemode mismatch' } })
    expect(d.recordPayment).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalled()
  })
  it('rejects bodies over 256 KB with 413', async () => {
    const d = deps()
    const r = await handlePaymongoWebhook(req('x'.repeat(MAX_WEBHOOK_BYTES + 1)), d)
    expect(r.status).toBe(413)
    expect(MAX_WEBHOOK_BYTES).toBe(256 * 1024)
  })
  it('returns 400 for a body that is not JSON', async () => {
    const r = await handlePaymongoWebhook(req('not json'), deps())
    expect(r.status).toBe(400)
  })
  it('returns 400 for JSON that is not an object', async () => {
    expect((await handlePaymongoWebhook(req('null'), deps())).status).toBe(400)
  })
  it.each([[''], [42], ['x'.repeat(201)], [null]])('returns 400 for a bad checkout id (%s)', async (id) => {
    const d = deps()
    const r = await handlePaymongoWebhook(req(event(undefined, { id })), d)
    expect(r.status).toBe(400)
    expect(d.recordPayment).not.toHaveBeenCalled()
  })
  it('propagates database errors so PayMongo retries', async () => {
    const d = deps(async () => { throw new Error('db down') })
    await expect(handlePaymongoWebhook(req(event()), d)).rejects.toThrow('db down')
    expect(d.sendConfirmation).not.toHaveBeenCalled()
  })
  it('ignores other event types', async () => {
    const d = deps()
    const r = await handlePaymongoWebhook(req(event('payment.failed')), d)
    expect(r).toEqual({ status: 200, body: { ignored: 'payment.failed' } })
    expect(d.recordPayment).not.toHaveBeenCalled()
  })
  it('still returns 200 if the email fails (stock is already updated)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps()
    vi.mocked(d.sendConfirmation).mockRejectedValueOnce(new Error('resend down'))
    vi.mocked(d.notifyOwner).mockRejectedValueOnce(new Error('resend down'))
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r.status).toBe(200)
  })
  it('returns 500 when the webhook secret is not configured', async () => {
    const r = await handlePaymongoWebhook(req(event()), { ...deps(), secret: '' })
    expect(r.status).toBe(500)
  })
})
