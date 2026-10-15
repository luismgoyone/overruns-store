import { describe, expect, it, vi } from 'vitest'
import { signPaymongoPayload } from './signature'
import { handlePaymongoWebhook } from './webhook'

const secret = 'whsk_test_secret'
const t = 1_760_000_000
const event = (type = 'checkout_session.payment.paid') =>
  JSON.stringify({ data: { id: 'evt_1', type: 'event', attributes: { type, livemode: false, data: { id: 'cs_123', type: 'checkout_session', attributes: {} } } } })

function deps(markPaid: (id: string) => Promise<string | null> = async () => 'order-1') {
  return { secret, markPaid: vi.fn(markPaid), sendConfirmation: vi.fn(async () => {}), nowMs: () => t * 1000 }
}
const req = (rawBody: string, header: string | null = signPaymongoPayload(rawBody, secret, t)) => ({ rawBody, signatureHeader: header })

describe('handlePaymongoWebhook', () => {
  it('marks the order paid and sends one confirmation', async () => {
    const d = deps()
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r.status).toBe(200)
    expect(d.markPaid).toHaveBeenCalledWith('cs_123')
    expect(d.sendConfirmation).toHaveBeenCalledWith('order-1')
  })
  it('does not email again when the order was already processed', async () => {
    const d = deps(async () => null)
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r.status).toBe(200)
    expect(d.sendConfirmation).not.toHaveBeenCalled()
  })
  it('rejects a bad signature without touching the database', async () => {
    const d = deps()
    const r = await handlePaymongoWebhook(req(event(), 't=1,te=deadbeef,li='), d)
    expect(r.status).toBe(401)
    expect(d.markPaid).not.toHaveBeenCalled()
  })
  it('returns 400 for a body that is not JSON', async () => {
    const r = await handlePaymongoWebhook(req('not json'), deps())
    expect(r.status).toBe(400)
  })
  it('ignores other event types', async () => {
    const d = deps()
    const r = await handlePaymongoWebhook(req(event('payment.failed')), d)
    expect(r).toEqual({ status: 200, body: { ignored: 'payment.failed' } })
    expect(d.markPaid).not.toHaveBeenCalled()
  })
  it('still returns 200 if the email fails (stock is already updated)', async () => {
    const d = deps()
    d.sendConfirmation.mockRejectedValueOnce(new Error('resend down'))
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r.status).toBe(200)
  })
  it('returns 500 when the webhook secret is not configured', async () => {
    const r = await handlePaymongoWebhook(req(event()), { ...deps(), secret: '' })
    expect(r.status).toBe(500)
  })
})
