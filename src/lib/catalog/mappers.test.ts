import { describe, expect, it } from 'vitest'
import { filterBySize, toProduct, type ProductRow } from './mappers'

const row = (over: Partial<ProductRow> = {}): ProductRow => ({
  id: 'p1', slug: 'tee', name: 'Tee', description: '', category: 'tops',
  price_centavos: 45000, retail_price_centavos: 129500, images: ['a.jpg'],
  is_active: true, is_featured: false, created_at: '2026-10-01T00:00:00Z',
  product_variants: [
    { id: 'v-xl', size: 'XL', stock: 1 },
    { id: 'v-s', size: 'S', stock: 0 },
    { id: 'v-m', size: 'M', stock: 2 },
  ],
  ...over,
})

describe('toProduct', () => {
  it('maps columns to camelCase and sorts variants XS→XXL→OS', () => {
    const p = toProduct(row())
    expect(p.priceCentavos).toBe(45000)
    expect(p.retailPriceCentavos).toBe(129500)
    expect(p.variants.map((v) => v.size)).toEqual(['S', 'M', 'XL'])
  })
})

describe('filterBySize', () => {
  it('keeps products that have the size in stock', () => {
    const products = [toProduct(row()), toProduct(row({ id: 'p2', slug: 'b', product_variants: [{ id: 'x', size: 'S', stock: 3 }] }))]
    expect(filterBySize(products, 'S').map((p) => p.id)).toEqual(['p2'])
    expect(filterBySize(products, null)).toHaveLength(2)
  })
})
