import { describe, expect, it } from 'vitest'
import { priceCart } from './price-cart'
import type { DbVariant } from './types'

const v = (over: Partial<DbVariant> = {}, product: Partial<DbVariant['product']> = {}): DbVariant => ({
  id: 'v1', size: 'M', stock: 3, ...over,
  product: { id: 'p1', name: 'Coach Jacket', isActive: true, priceCentavos: 149000, ...product },
})

describe('priceCart', () => {
  it('prices from the database and adds flat shipping', () => {
    const r = priceCart([{ variantId: 'v1', qty: 2, priceCentavos: 149000 }], [v()], 15000)
    expect(r).toEqual({
      ok: true,
      lines: [{ variantId: 'v1', productName: 'Coach Jacket', size: 'M', qty: 2, priceCentavos: 149000 }],
      subtotal: 298000, shipping: 15000, total: 313000,
    })
  })
  it('merges duplicate variant lines before checking stock', () => {
    const r = priceCart([{ variantId: 'v1', qty: 2, priceCentavos: 149000 }, { variantId: 'v1', qty: 2, priceCentavos: 149000 }], [v()], 15000)
    expect(r).toMatchObject({ ok: false, problems: [{ variantId: 'v1', reason: 'insufficient_stock', available: 3 }] })
  })
  it('flags missing, inactive and sold-out variants as unavailable', () => {
    const r = priceCart(
      [{ variantId: 'gone', qty: 1, priceCentavos: 1 }, { variantId: 'v1', qty: 1, priceCentavos: 149000 }, { variantId: 'v2', qty: 1, priceCentavos: 149000 }],
      [v({}, { isActive: false }), v({ id: 'v2', stock: 0 })],
      15000,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problems.map((p) => [p.variantId, p.reason])).toEqual([['gone', 'unavailable'], ['v1', 'unavailable'], ['v2', 'unavailable']])
  })
  it('flags a price change instead of silently charging the new price', () => {
    const r = priceCart([{ variantId: 'v1', qty: 1, priceCentavos: 99000 }], [v()], 15000)
    expect(r).toMatchObject({ ok: false, problems: [{ reason: 'price_changed', currentPriceCentavos: 149000 }] })
  })
})
