import { afterEach, describe, expect, it, vi } from 'vitest'
import { expireSession, getCheckoutSession } from '@/lib/paymongo/client'
import { cancelPendingOrderCore, expireStalePendingCore, reconcileOrderCore, type OrderPaymentState, type PaymentOpsDeps } from './payment-ops'
import type { PaymentRecord } from './payments'

const pending: OrderPaymentState = { id: 'order-1', status: 'pending', checkoutId: 'cs_123', createdAt: '2026-10-15T00:00:00Z' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const session = (attrs: Record<string, unknown> = {}) => json({ data: { id: 'cs_123', attributes: { status: 'active', payments: [], ...attrs } } })
const paidSession = () => session({ payments: [{ attributes: { status: 'paid', amount: 65000, currency: 'PHP' } }] })

// Uses the real PayMongo client against a mocked fetch, and in-memory orders for the database.
function deps(fetchImpl: ReturnType<typeof vi.fn>, order: OrderPaymentState | null = { ...pending }, others: OrderPaymentState[] = []) {
  const orders = [...(order ? [order] : []), ...others]
  const state = { get order() { return order }, orders }
  const byCheckout = (cs: string) => orders.find((o) => o.checkoutId === cs)
  const d = {
    state,
    getOrder: vi.fn(async (id: string) => { const o = orders.find((x) => x.id === id); return o ? { ...o } : null }),
    getSession: (id: string) => getCheckoutSession(id, { secretKey: 'sk_test_x', fetchImpl: fetchImpl as unknown as typeof fetch }),
    expireSession: vi.fn((id: string) => expireSession(id, { secretKey: 'sk_test_x', fetchImpl: fetchImpl as unknown as typeof fetch })),
    recordPayment: vi.fn(async (cs: string): Promise<PaymentRecord> => {
      const o = byCheckout(cs)
      if (!o) return { orderId: null, outcome: 'unknown', oversold: false, amountMismatch: false }
      if (o.status === 'paid') return { orderId: o.id, outcome: 'already_paid', oversold: false, amountMismatch: false }
      if (o.status === 'cancelled') return { orderId: o.id, outcome: 'paid_after_cancel', oversold: false, amountMismatch: false }
      o.status = 'paid'
      return { orderId: o.id, outcome: 'paid', oversold: false, amountMismatch: false }
    }),
    cancelOrder: vi.fn(async (id: string) => {
      const o = orders.find((x) => x.id === id)
      if (o?.status !== 'pending') return false
      o.status = 'cancelled'
      return true
    }),
    sendConfirmation: vi.fn(async () => {}),
    notifyOwner: vi.fn(async () => {}),
  } satisfies PaymentOpsDeps & { state: unknown }
  return d
}

afterEach(() => vi.restoreAllMocks())

describe('reconcileOrderCore', () => {
  it('marks a pending order paid exactly once when PayMongo says the session was paid', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => paidSession())
    const d = deps(fetchImpl)
    await expect(reconcileOrderCore('order-1', d)).resolves.toBe('paid')
    await expect(reconcileOrderCore('order-1', d)).resolves.toBe('not_pending')
    expect(d.recordPayment).toHaveBeenCalledTimes(1)
    expect(d.recordPayment).toHaveBeenCalledWith('cs_123', { paidCentavos: 65000, currency: 'PHP' })
    expect(d.sendConfirmation).toHaveBeenCalledTimes(1)
    expect(d.state.order?.status).toBe('paid')
  })
  it('leaves an unpaid order pending', async () => {
    const d = deps(vi.fn().mockResolvedValue(session()))
    await expect(reconcileOrderCore('order-1', d)).resolves.toBe('pending')
    expect(d.recordPayment).not.toHaveBeenCalled()
    expect(d.state.order?.status).toBe('pending')
  })
  it('stays pending and does not throw when PayMongo errors or is unreachable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const fetchImpl of [vi.fn().mockResolvedValue(json({ errors: [] }, 500)), vi.fn().mockRejectedValue(new TypeError('fetch failed'))]) {
      const d = deps(fetchImpl)
      await expect(reconcileOrderCore('order-1', d)).resolves.toBe('error')
      expect(d.recordPayment).not.toHaveBeenCalled()
      expect(d.state.order?.status).toBe('pending')
    }
    expect(warn).toHaveBeenCalled()
  })
  it('does not call PayMongo for orders that are not pending or have no session', async () => {
    const fetchImpl = vi.fn()
    await expect(reconcileOrderCore('order-1', deps(fetchImpl, { ...pending, status: 'paid' }))).resolves.toBe('not_pending')
    await expect(reconcileOrderCore('order-1', deps(fetchImpl, { ...pending, checkoutId: null }))).resolves.toBe('no_session')
    await expect(reconcileOrderCore('order-1', deps(fetchImpl, null))).resolves.toBe('not_found')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('does not throw when the database fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps(vi.fn().mockImplementation(async () => paidSession()))
    d.recordPayment.mockRejectedValueOnce(new Error('db down'))
    await expect(reconcileOrderCore('order-1', d)).resolves.toBe('error')
  })
})

describe('cancelPendingOrderCore', () => {
  it('expires the PayMongo session before cancelling', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(session({ status: 'expired' }))
    const d = deps(fetchImpl)
    await expect(cancelPendingOrderCore('order-1', d)).resolves.toEqual({ kind: 'cancelled' })
    expect(fetchImpl).toHaveBeenCalledWith('https://api.paymongo.com/v1/checkout_sessions/cs_123/expire', expect.objectContaining({ method: 'POST' }))
    expect(d.expireSession.mock.invocationCallOrder[0]).toBeLessThan(d.cancelOrder.mock.invocationCallOrder[0])
    expect(d.state.order?.status).toBe('cancelled')
  })
  it('does not cancel when PayMongo says the session was already paid, and records the payment instead', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ errors: [{ code: 'resource_failed_state' }] }, 400))
      .mockImplementation(async () => paidSession())
    const d = deps(fetchImpl)
    await expect(cancelPendingOrderCore('order-1', d)).resolves.toEqual({ kind: 'paid' })
    expect(d.cancelOrder).not.toHaveBeenCalled()
    expect(d.state.order?.status).toBe('paid')
    expect(d.sendConfirmation).toHaveBeenCalledWith('order-1')
  })
  it('cancels when PayMongo says the session had already expired', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ errors: [] }, 400))
      .mockResolvedValueOnce(session({ status: 'expired' }))
    await expect(cancelPendingOrderCore('order-1', deps(fetchImpl))).resolves.toEqual({ kind: 'cancelled' })
  })
  it('refuses to cancel when PayMongo cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps(vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const r = await cancelPendingOrderCore('order-1', d)
    expect(r).toEqual({ kind: 'error', message: expect.stringContaining('PayMongo') })
    expect(d.cancelOrder).not.toHaveBeenCalled()
  })
  it('cancels an order that never got a session without calling PayMongo', async () => {
    const fetchImpl = vi.fn()
    await expect(cancelPendingOrderCore('order-1', deps(fetchImpl, { ...pending, checkoutId: null }))).resolves.toEqual({ kind: 'cancelled' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('reports not_pending for an order that already moved on', async () => {
    await expect(cancelPendingOrderCore('order-1', deps(vi.fn(), { ...pending, status: 'paid' }))).resolves.toEqual({ kind: 'not_pending' })
  })
})

describe('expireStalePendingCore', () => {
  it('cancels stale unpaid orders and skips ones that turn out paid', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('cs_down')) throw new TypeError('fetch failed')
      if (url.includes('cs_paid')) return paidSession()
      return url.endsWith('/expire') ? session({ status: 'expired' }) : session()
    })
    const a = { ...pending, id: 'a', checkoutId: 'cs_unpaid' }
    const b = { ...pending, id: 'b', checkoutId: 'cs_paid' }
    const c = { ...pending, id: 'c', checkoutId: 'cs_down' }
    const e = { ...pending, id: 'e', checkoutId: null }
    const d = deps(fetchImpl, a, [b, c, e])
    const summary = await expireStalePendingCore(async () => ['a', 'b', 'c', 'e'], d)
    expect(summary).toEqual({ checked: 4, cancelled: 2, paid: 1, failed: 1 })
    expect([a.status, b.status, c.status, e.status]).toEqual(['cancelled', 'paid', 'pending', 'cancelled'])
    expect(d.cancelOrder).not.toHaveBeenCalledWith('b')
    expect(d.sendConfirmation).toHaveBeenCalledWith('b')
  })
})
