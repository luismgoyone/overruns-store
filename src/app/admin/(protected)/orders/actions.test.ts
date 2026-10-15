import { beforeEach, describe, expect, it, vi } from 'vitest'

const ID = '3f2a9c1e-1234-4abc-8def-0123456789ab'
const update = vi.fn()
const rpc = vi.fn()
const supabase = {
  from: () => ({ update: (row: unknown) => { update(row); const q = { eq: () => q, error: null }; return q } }),
  rpc: (...args: unknown[]) => rpc(...args),
}
const ops = vi.hoisted(() => ({ cancelPendingOrder: vi.fn(), reconcileOrder: vi.fn() }))
const email = vi.hoisted(() => ({ resendOrderConfirmation: vi.fn(), sendConfirmationIfUnsent: vi.fn() }))

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: async () => ({ supabase }) }))
vi.mock('@/lib/orders/payment-ops-server', () => ops)
vi.mock('@/lib/email/send-order-confirmation', () => email)
vi.mock('@/lib/catalog/revalidate', () => ({ revalidateCatalog: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw Object.assign(new Error('NEXT_REDIRECT'), { url }) } }))

const { acceptConflictedPayment, recheckPayment, resendConfirmation, updateOrderStatus } = await import('./actions')

const fd = (entries: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}
const redirectOf = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (err) {
    return (err as { url?: string }).url
  }
  return undefined
}

beforeEach(() => vi.clearAllMocks())

describe('updateOrderStatus', () => {
  it('cancels through PayMongo (expire first) instead of a plain status update', async () => {
    ops.cancelPendingOrder.mockResolvedValue({ kind: 'cancelled' })
    expect(await redirectOf(updateOrderStatus(fd({ id: ID, from: 'pending', to: 'cancelled' })))).toBe(`/admin/orders/${ID}?notice=cancelled`)
    expect(ops.cancelPendingOrder).toHaveBeenCalledWith(ID, expect.anything())
    expect(update).not.toHaveBeenCalled()
  })
  it('tells the admin when PayMongo says the order was already paid', async () => {
    ops.cancelPendingOrder.mockResolvedValue({ kind: 'paid' })
    expect(await redirectOf(updateOrderStatus(fd({ id: ID, from: 'pending', to: 'cancelled' })))).toBe(`/admin/orders/${ID}?notice=already-paid`)
  })
  it('does not cancel when PayMongo could not be reached', async () => {
    ops.cancelPendingOrder.mockResolvedValue({ kind: 'error', message: 'nope' })
    expect(await redirectOf(updateOrderStatus(fd({ id: ID, from: 'pending', to: 'cancelled' })))).toBe(`/admin/orders/${ID}?notice=cancel-failed`)
  })
  it('still ships paid orders with a guarded update', async () => {
    await updateOrderStatus(fd({ id: ID, from: 'paid', to: 'shipped' }))
    expect(update).toHaveBeenCalledWith({ status: 'shipped' })
    expect(ops.cancelPendingOrder).not.toHaveBeenCalled()
  })
  it('rejects transitions that are not allowed', async () => {
    await expect(updateOrderStatus(fd({ id: ID, from: 'pending', to: 'paid' }))).rejects.toThrow(/Can't move/)
  })
})

describe('recheckPayment', () => {
  it('reconciles with PayMongo and reports the result', async () => {
    ops.reconcileOrder.mockResolvedValue('paid')
    expect(await redirectOf(recheckPayment(fd({ id: ID })))).toBe(`/admin/orders/${ID}?notice=recheck-paid`)
    ops.reconcileOrder.mockResolvedValue('pending')
    expect(await redirectOf(recheckPayment(fd({ id: ID })))).toBe(`/admin/orders/${ID}?notice=recheck-pending`)
  })
})

describe('resendConfirmation', () => {
  it('resends and reports failures', async () => {
    expect(await redirectOf(resendConfirmation(fd({ id: ID })))).toBe(`/admin/orders/${ID}?notice=resent`)
    expect(email.resendOrderConfirmation).toHaveBeenCalledWith(ID)
    email.resendOrderConfirmation.mockRejectedValueOnce(new Error('resend down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await redirectOf(resendConfirmation(fd({ id: ID })))).toBe(`/admin/orders/${ID}?notice=resend-failed`)
  })
})

describe('acceptConflictedPayment', () => {
  it('fulfils a paid-after-cancel order and emails the customer', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    expect(await redirectOf(acceptConflictedPayment(fd({ id: ID })))).toBe(`/admin/orders/${ID}?notice=fulfilled`)
    expect(rpc).toHaveBeenCalledWith('accept_conflicted_payment', { p_order_id: ID })
    expect(email.sendConfirmationIfUnsent).toHaveBeenCalledWith(ID)
  })
})
