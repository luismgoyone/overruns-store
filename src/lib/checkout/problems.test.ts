import { describe, expect, it } from 'vitest'
import { cartReducer, type CartLine } from '@/lib/cart/cart'
import { problemMessage } from './problems'

const line = (over: Partial<CartLine>): CartLine => ({ variantId: 'v1', productId: 'p', slug: 's', name: 'Coach Jacket', size: 'M', priceCentavos: 99000, image: null, qty: 3, maxQty: 5, ...over })

describe('applyProblems', () => {
  it('removes unavailable lines, lowers qty to what is left, and updates prices', () => {
    const state = { hydrated: true, lines: [line({ variantId: 'gone' }), line({ variantId: 'low' }), line({ variantId: 'price' })] }
    const next = cartReducer(state, {
      type: 'applyProblems',
      problems: [
        { variantId: 'gone', reason: 'unavailable', available: 0 },
        { variantId: 'low', reason: 'insufficient_stock', available: 1 },
        { variantId: 'price', reason: 'price_changed', available: 5, currentPriceCentavos: 149000 },
      ],
    })
    expect(next.lines.map((l) => [l.variantId, l.qty, l.maxQty, l.priceCentavos])).toEqual([
      ['low', 1, 1, 99000],
      ['price', 3, 5, 149000],
    ])
  })
})

describe('problemMessage', () => {
  it('explains each problem in plain words', () => {
    expect(problemMessage({ variantId: 'a', reason: 'unavailable', available: 0, name: 'Coach Jacket', size: 'M' })).toBe('Coach Jacket (M) is sold out.')
    expect(problemMessage({ variantId: 'a', reason: 'insufficient_stock', available: 1, name: 'Coach Jacket', size: 'M' })).toBe('Only 1 left of Coach Jacket (M).')
    expect(problemMessage({ variantId: 'a', reason: 'price_changed', available: 2, currentPriceCentavos: 149000, name: 'Coach Jacket', size: 'M' })).toBe('Coach Jacket (M) is now ₱1,490.')
    expect(problemMessage({ variantId: 'a', reason: 'unavailable', available: 0 })).toBe('An item in your cart is no longer available.')
  })
})
