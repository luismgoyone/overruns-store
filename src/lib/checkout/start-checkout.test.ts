import { describe, expect, it, vi } from 'vitest'
import { startCheckoutCore, type StartCheckoutDeps } from './start-checkout'

const form = { name: 'Juan', phone: '+639171234567', email: 'juan@example.com', street: '12 Mabini', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '1210' }
const variant = { id: '00000000-0000-4000-8000-000000000001', size: 'M' as const, stock: 2, product: { id: 'p1', name: 'Tee', isActive: true, priceCentavos: 45000 } }
const cart = [{ variantId: variant.id, qty: 1, priceCentavos: 45000 }]

function deps(over: Partial<StartCheckoutDeps> = {}): StartCheckoutDeps {
  return {
    loadVariants: vi.fn().mockResolvedValue([variant]),
    createPendingOrder: vi.fn().mockResolvedValue('order-1'),
    attachCheckout: vi.fn().mockResolvedValue(undefined),
    cancelOrder: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue({ id: 'cs_1', checkoutUrl: 'https://checkout.paymongo.com/cs_1' }),
    shippingFeeCentavos: 15000,
    siteUrl: 'https://shop.test',
    paymentMethods: ['card', 'gcash'],
    ...over,
  }
}

describe('startCheckoutCore', () => {
  it('creates a pending order, a session with success/cancel URLs, and redirects', async () => {
    const d = deps()
    const r = await startCheckoutCore(form, cart, d)
    expect(r).toEqual({ kind: 'redirect', url: 'https://checkout.paymongo.com/cs_1' })
    expect(d.createPendingOrder).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 45000, shipping: 15000, total: 60000 }))
    expect(d.createSession).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1',
      successUrl: 'https://shop.test/order/order-1',
      cancelUrl: 'https://shop.test/cart?cancelled=1',
    }))
    expect(d.attachCheckout).toHaveBeenCalledWith('order-1', 'cs_1')
  })
  it('returns cart problems without creating an order', async () => {
    const d = deps({ loadVariants: vi.fn().mockResolvedValue([{ ...variant, stock: 0 }]) })
    const r = await startCheckoutCore(form, cart, d)
    expect(r.kind).toBe('cart_problems')
    expect(d.createPendingOrder).not.toHaveBeenCalled()
  })
  it('cancels the order and reports an error if PayMongo fails', async () => {
    const d = deps({ createSession: vi.fn().mockRejectedValue(new Error('down')) })
    const r = await startCheckoutCore(form, cart, d)
    expect(r).toEqual({ kind: 'error', message: expect.stringContaining('payment page') })
    expect(d.cancelOrder).toHaveBeenCalledWith('order-1')
  })
})
