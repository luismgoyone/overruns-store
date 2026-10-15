'use client'

import Form from 'next/form'
import { CATEGORIES, SIZES, sizeLabel } from '@/lib/catalog/constants'
import type { ShopFilters as Filters } from '@/lib/catalog/params'

const select = 'h-11 w-full border border-ink bg-card px-2 text-sm'

export function ShopFilters({ filters }: { filters: Filters }) {
  return (
    <Form action="/shop" onChange={(e) => e.currentTarget.requestSubmit()} className="sticky top-14 z-20 grid grid-cols-3 gap-2 border-b border-ink bg-paper px-4 py-3">
      <label className="sr-only" htmlFor="f-category">Category</label>
      <select id="f-category" name="category" defaultValue={filters.category ?? ''} className={select}>
        <option value="">All categories</option>
        {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>
      <label className="sr-only" htmlFor="f-size">Size</label>
      <select id="f-size" name="size" defaultValue={filters.size ?? ''} className={select}>
        <option value="">All sizes</option>
        {SIZES.map((s) => <option key={s} value={s}>{sizeLabel(s)}</option>)}
      </select>
      <label className="sr-only" htmlFor="f-sort">Sort</label>
      <select id="f-sort" name="sort" defaultValue={filters.sort} className={select}>
        <option value="newest">Newest</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>
      <noscript><button type="submit" className="col-span-3 h-11 border border-ink">Apply</button></noscript>
    </Form>
  )
}
