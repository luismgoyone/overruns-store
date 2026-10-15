import { describe, expect, it } from 'vitest'
import { computeTotals } from './totals'

describe('computeTotals', () => {
  it('adds flat shipping to a non-empty cart', () => {
    expect(computeTotals(100000, 15000)).toEqual({ subtotal: 100000, shipping: 15000, total: 115000 })
  })
  it('charges no shipping on an empty cart', () => {
    expect(computeTotals(0, 15000)).toEqual({ subtotal: 0, shipping: 0, total: 0 })
  })
})
