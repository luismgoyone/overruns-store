import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DuplicateOrderError } from './start-checkout'

const rpc = vi.fn()
const update = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({ update: (row: unknown) => { update(row); return { eq: async () => ({ error: null }) } } }),
  }),
}))
const { buildCheckoutDeps } = await import('./deps')

const order = {
  customer: { name: 'Juan', phone: '+639171234567', email: 'juan@example.com', street: '1', barangay: 'B', city: 'C', province: 'P', zip: '1210' },
  lines: [{ variantId: 'v1', productName: 'Tee', size: 'M' as const, qty: 1, priceCentavos: 45000 }],
  subtotal: 45000, shipping: 15000, total: 60000, idempotencyKey: '8a1b7f1e-4d5c-4e2a-9b3c-0d1e2f3a4b5c',
}

beforeEach(() => vi.clearAllMocks())

describe('buildCheckoutDeps.createPendingOrder', () => {
  it('maps a unique violation on the idempotency key to DuplicateOrderError', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "orders_idempotency_key_key"', details: 'Key (idempotency_key)=(…) already exists.' } })
    await expect(buildCheckoutDeps('sk_test_x').createPendingOrder(order)).rejects.toBeInstanceOf(DuplicateOrderError)
  })
  it('rethrows other unique violations as real errors', async () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint "order_items_order_id_variant_id_key"', details: '' }
    rpc.mockResolvedValue({ data: null, error })
    await expect(buildCheckoutDeps('sk_test_x').createPendingOrder(order)).rejects.toBe(error)
  })
})

describe('buildCheckoutDeps.attachCheckout', () => {
  it('records the PayMongo mode of the key that created the session', async () => {
    await buildCheckoutDeps('sk_test_x').attachCheckout('order-1', 'cs_1', 'https://checkout.paymongo.com/cs_1')
    expect(update).toHaveBeenCalledWith({ paymongo_checkout_id: 'cs_1', paymongo_checkout_url: 'https://checkout.paymongo.com/cs_1', paymongo_livemode: false })
    await buildCheckoutDeps('sk_live_x').attachCheckout('order-1', 'cs_1', 'u')
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ paymongo_livemode: true }))
  })
})
