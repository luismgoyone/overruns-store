import { describe, expect, it } from 'vitest'
import { canTransition, nextStatuses } from './order-status'

describe('order status transitions', () => {
  it('lets the owner ship paid orders and cancel unpaid ones', () => {
    expect(nextStatuses('pending')).toEqual(['cancelled'])
    expect(nextStatuses('paid')).toEqual(['shipped'])
    expect(nextStatuses('shipped')).toEqual([])
    expect(nextStatuses('cancelled')).toEqual([])
  })
  it('blocks marking orders paid by hand (only the webhook does that)', () => {
    expect(canTransition('pending', 'paid')).toBe(false)
    expect(canTransition('paid', 'shipped')).toBe(true)
    expect(canTransition('shipped', 'pending')).toBe(false)
  })
})
