import { describe, expect, it } from 'vitest'
import { cartClearMode, RECONCILE_AFTER_MS, RECONCILE_GAP_MS, shouldReconcile, takeReconcileSlot } from './order-page'

const now = Date.parse('2026-10-16T12:00:00Z')
const ago = (ms: number) => new Date(now - ms).toISOString()

describe('cartClearMode', () => {
  it('clears for paid and shipped, only with this tab’s checkout marker while pending, never when cancelled', () => {
    expect(cartClearMode('paid')).toBe('always')
    expect(cartClearMode('shipped')).toBe('always')
    expect(cartClearMode('pending')).toBe('if-marker')
    expect(cartClearMode('cancelled')).toBe('never')
  })
})

describe('shouldReconcile', () => {
  const order = { status: 'pending' as const, createdAt: ago(RECONCILE_AFTER_MS + 1) }
  it('asks PayMongo about pending orders older than ~30s when a key is configured', () => {
    expect(RECONCILE_AFTER_MS).toBe(30_000)
    expect(shouldReconcile(order, { now, hasKey: true })).toBe(true)
  })
  it('skips fresh, non-pending or unconfigured cases', () => {
    expect(shouldReconcile({ ...order, createdAt: ago(5_000) }, { now, hasKey: true })).toBe(false)
    expect(shouldReconcile({ ...order, status: 'paid' }, { now, hasKey: true })).toBe(false)
    expect(shouldReconcile(order, { now, hasKey: false })).toBe(false)
  })
})

describe('takeReconcileSlot', () => {
  it('allows one PayMongo check per order every 10 seconds', () => {
    expect(takeReconcileSlot('o1', now)).toBe(true)
    expect(takeReconcileSlot('o1', now + 3_000)).toBe(false)
    expect(takeReconcileSlot('o2', now + 3_000)).toBe(true)
    expect(takeReconcileSlot('o1', now + RECONCILE_GAP_MS)).toBe(true)
  })
})
