import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/supabase/database.types'
import { getProductBySlug, listProducts } from './queries'

describe.skipIf(process.env.SUPABASE_INTEGRATION !== '1')('catalog queries against local Supabase', () => {
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  it('lists active products newest first', async () => {
    const products = await listProducts(db, { category: null, size: null, sort: 'newest' })
    expect(products.length).toBeGreaterThanOrEqual(12)
    const dates = products.map((p) => p.createdAt)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('filters by category and sorts by price', async () => {
    const products = await listProducts(db, { category: 'bottoms', size: null, sort: 'price-asc' })
    expect(products.every((p) => p.category === 'bottoms')).toBe(true)
    const prices = products.map((p) => p.priceCentavos)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
  })

  it('gets a product with variants in size order, or null', async () => {
    const p = await getProductBySlug(db, 'oxford-button-down-white')
    expect(p?.variants.map((v) => v.size)).toEqual(['S', 'M', 'L', 'XL'])
    expect(await getProductBySlug(db, 'does-not-exist')).toBeNull()
  })
})
