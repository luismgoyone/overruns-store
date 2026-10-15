import { describe, expect, it } from 'vitest'
import { centavosToPesoInput, parsePesoToCentavos, parseProductForm, slugify } from './product-form'

const fd = (entries: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}
const base = { name: 'Coach Jacket', slug: '', description: 'Nylon', category: 'outerwear', price: '1,490', retailPrice: '4299', images: '["products/a.jpg"]', isActive: 'on', stock_M: '2', stock_L: '0', stock_XL: '' }

describe('parsePesoToCentavos', () => {
  it('parses peso amounts into centavos', () => {
    expect(parsePesoToCentavos('690')).toBe(69000)
    expect(parsePesoToCentavos('₱1,899.50')).toBe(189950)
    expect(parsePesoToCentavos('0.5')).toBe(50)
  })
  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '-1', '1.999', '1e3']) expect(parsePesoToCentavos(bad)).toBeNull()
  })
  it('round-trips through the input formatter', () => {
    expect(centavosToPesoInput(189950)).toBe('1899.50')
    expect(centavosToPesoInput(69000)).toBe('690')
    expect(centavosToPesoInput(null)).toBe('')
  })
})

describe('slugify', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('  Oxford Button-Down (White) ')).toBe('oxford-button-down-white')
    expect(slugify('Piña Polo')).toBe('pina-polo')
  })
})

describe('parseProductForm', () => {
  it('parses a valid form, deriving the slug and keeping only entered sizes', () => {
    const r = parseProductForm(fd(base))
    expect(r).toEqual({
      ok: true,
      data: {
        name: 'Coach Jacket', slug: 'coach-jacket', description: 'Nylon', category: 'outerwear',
        priceCentavos: 149000, retailPriceCentavos: 429900, images: ['products/a.jpg'],
        isActive: true, isFeatured: false, stock: { M: 2, L: 0 },
      },
    })
  })
  it('reports field errors', () => {
    const r = parseProductForm(fd({ ...base, name: '', category: 'shoes', price: 'abc', retailPrice: '100', stock_M: '-1' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.fieldErrors).sort()).toEqual(['category', 'name', 'price', 'stock_M'])
  })
  it('requires the retail price to be higher than the overrun price', () => {
    const r = parseProductForm(fd({ ...base, retailPrice: '1000' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors.retailPrice).toMatch(/higher/)
  })
  it('requires at least one size', () => {
    const r = parseProductForm(fd({ ...base, stock_M: '', stock_L: '' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors.stock).toBeDefined()
  })
})
