import { describe, expect, it, vi } from 'vitest'
import { createCheckoutSession, expireSession, getCheckoutSession, keyLivemode, parseCheckoutSession, PayMongoError, SessionActiveError } from './client'

const input = {
  orderId: '3f2a9c1e-0000-4000-8000-000000000000',
  lines: [{ variantId: 'v1', productName: 'Coach Jacket', size: 'M' as const, qty: 2, priceCentavos: 149000 }],
  shippingCentavos: 15000,
  customer: { name: 'Juan', email: 'juan@example.com', phone: '+639171234567' },
  successUrl: 'https://shop.test/order/3f2a',
  cancelUrl: 'https://shop.test/cart?cancelled=1',
  paymentMethods: ['card', 'gcash', 'paymaya', 'qrph'],
}

describe('createCheckoutSession', () => {
  it('posts line items in centavos with basic auth and returns the session', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'cs_123', attributes: { checkout_url: 'https://checkout.paymongo.com/cs_123' } } }), { status: 200 }))
    const result = await createCheckoutSession(input, { secretKey: 'sk_test_abc', fetchImpl })
    expect(result).toEqual({ id: 'cs_123', checkoutUrl: 'https://checkout.paymongo.com/cs_123' })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.paymongo.com/v1/checkout_sessions')
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('sk_test_abc:').toString('base64')}`)
    const attrs = JSON.parse(init.body).data.attributes
    expect(attrs.line_items).toEqual([
      { currency: 'PHP', amount: 149000, name: 'Coach Jacket (M)', quantity: 2 },
      { currency: 'PHP', amount: 15000, name: 'Shipping (flat rate)', quantity: 1 },
    ])
    expect(attrs.payment_method_types).toEqual(['card', 'gcash', 'paymaya', 'qrph'])
    expect(attrs.reference_number).toBe(input.orderId)
    expect(attrs.metadata).toEqual({ order_id: input.orderId })
    expect(attrs.cancel_url).toBe(input.cancelUrl)
  })
  it('throws PayMongoError with the response body on failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ detail: 'bad key' }] }), { status: 401 }))
    await expect(createCheckoutSession(input, { secretKey: 'bad', fetchImpl })).rejects.toBeInstanceOf(PayMongoError)
  })
})

const session = (attrs: Record<string, unknown>) => ({ data: { id: 'cs_123', type: 'checkout_session', attributes: { status: 'active', payments: [], payment_intent: null, livemode: false, ...attrs } } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const paidPayment = (amount: number, status = 'paid') => ({ id: 'pay_1', type: 'payment', attributes: { amount, currency: 'PHP', status } })

describe('parseCheckoutSession', () => {
  it('reads a paid session from its payments', () => {
    expect(parseCheckoutSession(session({ payments: [paidPayment(65000)] }).data)).toEqual({ id: 'cs_123', status: 'active', paid: true, paidCentavos: 65000, currency: 'PHP', livemode: false })
  })
  it('reads a paid session from a succeeded payment intent', () => {
    const s = parseCheckoutSession(session({ payment_intent: { id: 'pi_1', attributes: { status: 'succeeded', amount: 65000, currency: 'PHP' } } }).data)
    expect(s.paid).toBe(true)
  })
  it('treats failed payments and awaiting intents as unpaid', () => {
    const s = parseCheckoutSession(session({ payments: [paidPayment(65000, 'failed')], payment_intent: { attributes: { status: 'awaiting_payment_method' } } }).data)
    expect(s).toMatchObject({ paid: false, paidCentavos: null })
  })
  it('survives a resource with no attributes', () => {
    expect(parseCheckoutSession({ id: 'cs_1' })).toMatchObject({ id: 'cs_1', paid: false, paidCentavos: null, currency: null, livemode: null })
  })
})

describe('getCheckoutSession', () => {
  it('GETs the session with basic auth', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(session({ payments: [paidPayment(65000)] })))
    const s = await getCheckoutSession('cs_123', { secretKey: 'sk_test_abc', fetchImpl })
    expect(s.paid).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.paymongo.com/v1/checkout_sessions/cs_123')
    expect(init.method).toBe('GET')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
  it('throws PayMongoError on failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ errors: [] }, 500))
    await expect(getCheckoutSession('cs_123', { secretKey: 'k', fetchImpl })).rejects.toBeInstanceOf(PayMongoError)
  })
  it('refuses ids that are not PayMongo-shaped without calling the API', async () => {
    const fetchImpl = vi.fn()
    await expect(getCheckoutSession('../payments', { secretKey: 'k', fetchImpl })).rejects.toBeInstanceOf(PayMongoError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('expireSession', () => {
  it('POSTs to the expire endpoint and reports expired', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(session({ status: 'expired' })))
    await expect(expireSession('cs_123', { secretKey: 'k', fetchImpl })).resolves.toBe('expired')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.paymongo.com/v1/checkout_sessions/cs_123/expire')
    expect(init.method).toBe('POST')
  })
  it('reports paid when PayMongo refuses because the session was paid', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ errors: [{ code: 'resource_failed_state', detail: 'already paid' }] }, 400))
      .mockResolvedValueOnce(json(session({ payments: [paidPayment(65000)] })))
    await expect(expireSession('cs_123', { secretKey: 'k', fetchImpl })).resolves.toBe('paid')
  })
  it('reports expired when PayMongo refuses because it already expired', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ errors: [{ code: 'resource_failed_state' }] }, 400))
      .mockResolvedValueOnce(json(session({ status: 'expired' })))
    await expect(expireSession('cs_123', { secretKey: 'k', fetchImpl })).resolves.toBe('expired')
  })
  it('throws when the session is still open and could not be expired', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ errors: [] }, 500))
      .mockResolvedValueOnce(json(session({ status: 'active' })))
    await expect(expireSession('cs_123', { secretKey: 'k', fetchImpl })).rejects.toBeInstanceOf(PayMongoError)
  })
  it('throws when PayMongo is unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    await expect(expireSession('cs_123', { secretKey: 'k', fetchImpl })).rejects.toThrow()
  })
})

describe('expireSession edge cases', () => {
  it('treats a session PayMongo no longer knows (404 on expire and GET) as expired', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ errors: [{ code: 'resource_not_found' }] }, 404))
    await expect(expireSession('cs_123', { secretKey: 'k', fetchImpl })).resolves.toBe('expired')
  })
  it('throws SessionActiveError when the session is still open (a payment may be in progress)', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ errors: [] }, 400))
      .mockResolvedValueOnce(json(session({ status: 'active' })))
    await expect(expireSession('cs_123', { secretKey: 'k', fetchImpl })).rejects.toBeInstanceOf(SessionActiveError)
  })
})

describe('getCheckoutSession timeout', () => {
  it('uses a shorter timeout when asked (order page render path)', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout')
    const fetchImpl = vi.fn().mockResolvedValue(json(session({})))
    await getCheckoutSession('cs_123', { secretKey: 'k', fetchImpl, timeoutMs: 3_000 })
    expect(spy).toHaveBeenCalledWith(3_000)
    spy.mockRestore()
  })
})

describe('keyLivemode', () => {
  it('reads the mode from the secret key prefix', () => {
    expect(keyLivemode('sk_live_abc')).toBe(true)
    expect(keyLivemode('sk_test_abc')).toBe(false)
    expect(keyLivemode('weird')).toBeNull()
    expect(keyLivemode(null)).toBeNull()
  })
})
