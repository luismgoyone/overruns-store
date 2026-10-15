import { describe, expect, it } from 'vitest'
import { cartCount, cartReducer, cartSubtotal, EMPTY_CART, MAX_QTY_PER_LINE, parseStoredCart, type CartLine, type CartState } from './cart'

const line = (over: Partial<Omit<CartLine, 'qty'>> = {}): Omit<CartLine, 'qty'> => ({
  variantId: 'v-m', productId: 'p1', slug: 'tee', name: 'Tee', size: 'M',
  priceCentavos: 50000, image: null, maxQty: 3, ...over,
})
const ready: CartState = { lines: [], hydrated: true }

describe('cartReducer', () => {
  it('adds a new line with qty 1', () => {
    const s = cartReducer(ready, { type: 'add', line: line() })
    expect(s.lines).toEqual([{ ...line(), qty: 1 }])
  })
  it('merges the same variant and caps at stock', () => {
    let s = cartReducer(ready, { type: 'add', line: line(), qty: 2 })
    s = cartReducer(s, { type: 'add', line: line(), qty: 2 })
    expect(s.lines).toHaveLength(1)
    expect(s.lines[0].qty).toBe(3)
  })
  it('ignores sold-out variants', () => {
    expect(cartReducer(ready, { type: 'add', line: line({ maxQty: 0 }) })).toBe(ready)
  })
  it('caps a line at MAX_QTY_PER_LINE', () => {
    const s = cartReducer(ready, { type: 'add', line: line({ maxQty: 50 }), qty: 99 })
    expect(s.lines[0].qty).toBe(MAX_QTY_PER_LINE)
  })
  it('setQty clamps to stock and removes at zero', () => {
    let s = cartReducer(ready, { type: 'add', line: line() })
    s = cartReducer(s, { type: 'setQty', variantId: 'v-m', qty: 9 })
    expect(s.lines[0].qty).toBe(3)
    s = cartReducer(s, { type: 'setQty', variantId: 'v-m', qty: 0 })
    expect(s.lines).toEqual([])
  })
  it('ignores non-finite or non-positive quantities', () => {
    expect(cartReducer(ready, { type: 'add', line: line(), qty: 0 })).toBe(ready)
    expect(cartReducer(ready, { type: 'add', line: line(), qty: Number.NaN })).toBe(ready)
    const s = cartReducer(ready, { type: 'add', line: line() })
    expect(cartReducer(s, { type: 'setQty', variantId: 'v-m', qty: Number.NaN })).toBe(s)
  })
  it('removes and clears but stays hydrated', () => {
    let s = cartReducer(ready, { type: 'add', line: line() })
    s = cartReducer(s, { type: 'add', line: line({ variantId: 'v-l', size: 'L' }) })
    s = cartReducer(s, { type: 'remove', variantId: 'v-m' })
    expect(s.lines.map((l) => l.variantId)).toEqual(['v-l'])
    s = cartReducer(s, { type: 'clear' })
    expect(s).toEqual({ lines: [], hydrated: true })
  })
  it('hydrate replaces lines and marks the cart hydrated', () => {
    const s = cartReducer(EMPTY_CART, { type: 'hydrate', lines: [{ ...line(), qty: 2 }] })
    expect(s.hydrated).toBe(true)
    expect(cartCount(s.lines)).toBe(2)
    expect(cartSubtotal(s.lines)).toBe(100000)
  })
})

describe('parseStoredCart', () => {
  it('returns an empty cart for missing or corrupt data', () => {
    expect(parseStoredCart(null)).toEqual([])
    expect(parseStoredCart('not json')).toEqual([])
    expect(parseStoredCart('{"lines":"nope"}')).toEqual([])
  })
  it('keeps valid lines, drops invalid ones and clamps qty', () => {
    const raw = JSON.stringify([{ ...line(), qty: 9 }, { variantId: 'broken' }])
    expect(parseStoredCart(raw)).toEqual([{ ...line(), qty: 3 }])
  })
})
