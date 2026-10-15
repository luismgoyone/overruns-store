import { afterEach, describe, expect, it, vi } from 'vitest'
import { DuplicateOrderError, startCheckoutCore, type StartCheckoutDeps } from './start-checkout'

const form = { name: 'Juan', phone: '+639171234567', email: 'juan@example.com', street: '12 Mabini', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '1210' }
const variant = { id: '00000000-0000-4000-8000-000000000001', size: 'M' as const, stock: 2, product: { id: 'p1', name: 'Tee', isActive: true, priceCentavos: 45000 } }
const cart = [{ variantId: variant.id, qty: 1, priceCentavos: 45000 }]

function deps(over: Partial<StartCheckoutDeps> = {}): StartCheckoutDeps {
  return {
    loadVariants: vi.fn().mockResolvedValue([variant]),
    findOrderByKey: vi.fn().mockResolvedValue(null),
    expireSession: vi.fn().mockResolvedValue('expired'),
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

afterEach(() => vi.restoreAllMocks())

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
    expect(d.attachCheckout).toHaveBeenCalledWith('order-1', 'cs_1', 'https://checkout.paymongo.com/cs_1')
  })
  it('returns cart problems without creating an order', async () => {
    const d = deps({ loadVariants: vi.fn().mockResolvedValue([{ ...variant, stock: 0 }]) })
    const r = await startCheckoutCore(form, cart, d)
    expect(r.kind).toBe('cart_problems')
    expect(d.createPendingOrder).not.toHaveBeenCalled()
  })
  it('reports a friendly error if the database fails before an order exists', async () => {
    const d = deps({ createPendingOrder: vi.fn().mockRejectedValue(new Error('db down')) })
    const r = await startCheckoutCore(form, cart, d)
    expect(r).toEqual({ kind: 'error', message: expect.stringContaining('preparing your order') })
    expect(d.createSession).not.toHaveBeenCalled()
  })
  it('cancels the order and reports an error if PayMongo fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps({ createSession: vi.fn().mockRejectedValue(new Error('down')) })
    const r = await startCheckoutCore(form, cart, d)
    expect(r).toEqual({ kind: 'error', message: expect.stringContaining('payment page') })
    expect(d.cancelOrder).toHaveBeenCalledWith('order-1')
    expect(d.expireSession).not.toHaveBeenCalled()
  })
  it('expires a session it could not attach before cancelling the order', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps({ attachCheckout: vi.fn().mockRejectedValue(new Error('db blip')) })
    const r = await startCheckoutCore(form, cart, d)
    expect(r.kind).toBe('error')
    expect(d.expireSession).toHaveBeenCalledWith('cs_1')
    expect(vi.mocked(d.expireSession).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(d.cancelOrder).mock.invocationCallOrder[0])
  })
})

describe('startCheckoutCore idempotency', () => {
  const KEY = '8a1b7f1e-4d5c-4e2a-9b3c-0d1e2f3a4b5c'
  // Stateful fake: remembers orders by idempotency key like the unique index does.
  function statefulDeps() {
    const orders = new Map<string, { id: string; status: 'pending' | 'paid' | 'cancelled'; checkoutUrl: string | null }>()
    let n = 0
    return deps({
      findOrderByKey: vi.fn(async (key: string) => orders.get(key) ?? null),
      createPendingOrder: vi.fn(async (o) => {
        if (o.idempotencyKey && orders.has(o.idempotencyKey)) throw new DuplicateOrderError()
        const id = `order-${++n}`
        if (o.idempotencyKey) orders.set(o.idempotencyKey, { id, status: 'pending', checkoutUrl: null })
        return id
      }),
      attachCheckout: vi.fn(async (id: string, _cs: string, url: string) => {
        for (const o of orders.values()) if (o.id === id) o.checkoutUrl = url
      }),
    })
  }

  it('the same key twice creates one order and one session, and both go to the same payment page', async () => {
    const d = statefulDeps()
    const first = await startCheckoutCore(form, cart, d, KEY)
    const second = await startCheckoutCore(form, cart, d, KEY)
    expect(first).toEqual({ kind: 'redirect', url: 'https://checkout.paymongo.com/cs_1' })
    expect(second).toEqual(first)
    expect(d.createPendingOrder).toHaveBeenCalledTimes(1)
    expect(d.createSession).toHaveBeenCalledTimes(1)
    expect(d.createPendingOrder).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: KEY }))
  })
  it('a concurrent double submit that loses the insert race gets a friendly retry message', async () => {
    const d = statefulDeps()
    let release!: () => void
    vi.mocked(d.createSession).mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ id: 'cs_1', checkoutUrl: 'https://checkout.paymongo.com/cs_1' }) }))
    const first = startCheckoutCore(form, cart, d, KEY)
    await vi.waitFor(() => expect(d.createSession).toHaveBeenCalled())
    const second = await startCheckoutCore(form, cart, d, KEY)
    expect(second).toEqual({ kind: 'error', message: expect.stringContaining('already processing') })
    release()
    expect(await first).toEqual({ kind: 'redirect', url: 'https://checkout.paymongo.com/cs_1' })
    expect(d.createSession).toHaveBeenCalledTimes(1)
  })
  it('treats a unique-key collision during insert like an existing order', async () => {
    const d = deps({
      findOrderByKey: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'order-9', status: 'pending', checkoutUrl: 'https://checkout.paymongo.com/cs_9' }),
      createPendingOrder: vi.fn().mockRejectedValue(new DuplicateOrderError()),
    })
    expect(await startCheckoutCore(form, cart, d, KEY)).toEqual({ kind: 'redirect', url: 'https://checkout.paymongo.com/cs_9' })
    expect(d.createSession).not.toHaveBeenCalled()
  })
  it('sends a repeat of a paid checkout to its order page', async () => {
    const d = deps({ findOrderByKey: vi.fn().mockResolvedValue({ id: 'order-7', status: 'paid', checkoutUrl: 'https://checkout.paymongo.com/cs_7' }) })
    expect(await startCheckoutCore(form, cart, d, KEY)).toEqual({ kind: 'redirect', url: 'https://shop.test/order/order-7' })
  })
  it('works without a key (older cached pages)', async () => {
    const d = deps()
    expect((await startCheckoutCore(form, cart, d, null)).kind).toBe('redirect')
    expect(d.findOrderByKey).not.toHaveBeenCalled()
  })
})
