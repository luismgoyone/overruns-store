import { describe, expect, it, vi } from 'vitest'
import { createCheckoutSession, PayMongoError } from './client'

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
