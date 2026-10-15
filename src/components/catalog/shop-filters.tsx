'use client'

import Form from 'next/form'
import Link from 'next/link'
import { CATEGORIES, SIZES, sizeLabel } from '@/lib/catalog/constants'
import type { ShopFilters as Filters } from '@/lib/catalog/params'

const select = 'h-11 w-full appearance-none border border-hairline bg-card bg-[length:10px] bg-[right_0.6rem_center] bg-no-repeat pl-2 pr-6 font-mono text-[11px] uppercase tracking-[0.1em] hover:border-ink sm:text-xs'
// Small chevron so the native selects still read as dropdowns after `appearance-none`.
const chevron = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23111' stroke-width='1.5'/%3E%3C/svg%3E\")" }
const heading = 'border-b border-hairline pb-3 font-mono text-xs uppercase tracking-[0.15em]'

function shopHref(f: Filters) {
  const p = new URLSearchParams()
  if (f.category) p.set('category', f.category)
  if (f.size) p.set('size', f.size)
  if (f.sort !== 'newest') p.set('sort', f.sort)
  const q = p.toString()
  return q ? `/shop?${q}` : '/shop'
}

function SortOptions() {
  return (
    <>
      <option value="newest">Newest</option>
      <option value="price-asc">Price: low to high</option>
      <option value="price-desc">Price: high to low</option>
    </>
  )
}

/** Mobile: one row of three auto-submitting selects. */
export function ShopFilters({ filters }: { filters: Filters }) {
  return (
    <Form action="/shop" onChange={(e) => e.currentTarget.requestSubmit()} className="sticky top-16 z-20 grid grid-cols-3 gap-2 border-b border-hairline bg-paper px-4 py-3 lg:hidden">
      <label className="sr-only" htmlFor="f-category">Category</label>
      <select id="f-category" name="category" defaultValue={filters.category ?? ''} className={select} style={chevron}>
        <option value="">All categories</option>
        {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>
      <label className="sr-only" htmlFor="f-size">Size</label>
      <select id="f-size" name="size" defaultValue={filters.size ?? ''} className={select} style={chevron}>
        <option value="">All sizes</option>
        {SIZES.map((s) => <option key={s} value={s}>{sizeLabel(s)}</option>)}
      </select>
      <label className="sr-only" htmlFor="f-sort">Sort</label>
      <select id="f-sort" name="sort" defaultValue={filters.sort} className={select} style={chevron}>
        <SortOptions />
      </select>
      <noscript><button type="submit" className="col-span-3 h-11 border border-ink font-mono text-xs uppercase">Apply</button></noscript>
    </Form>
  )
}

/** Desktop: sort dropdown that keeps the current category and size. */
export function ShopSort({ filters }: { filters: Filters }) {
  return (
    <Form action="/shop" onChange={(e) => e.currentTarget.requestSubmit()} className="hidden items-center gap-3 lg:flex">
      {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
      {filters.size ? <input type="hidden" name="size" value={filters.size} /> : null}
      <label htmlFor="f-sort-desktop" className="font-mono text-xs uppercase tracking-[0.15em] text-muted">Sort:</label>
      <select id="f-sort-desktop" name="sort" defaultValue={filters.sort} className={`${select} w-52`} style={chevron}>
        <SortOptions />
      </select>
      <noscript><button type="submit" className="h-11 border border-ink px-3 font-mono text-xs uppercase">Apply</button></noscript>
    </Form>
  )
}

/** Desktop: category list and size grid as plain links. */
export function ShopSidebar({ filters }: { filters: Filters }) {
  const categories = [{ slug: null, label: 'All' }, ...CATEGORIES]
  const sizes = [null, ...SIZES]
  return (
    <aside className="hidden space-y-10 lg:block">
      <nav aria-label="Category" className="space-y-2">
        <h2 className={heading}>Category</h2>
        <ul>
          {categories.map((c) => {
            const active = filters.category === c.slug
            return (
              <li key={c.slug ?? 'all'}>
                <Link href={shopHref({ ...filters, category: c.slug })} aria-current={active ? 'page' : undefined} className={`flex h-10 items-center hover:underline hover:underline-offset-4 ${active ? 'font-bold' : 'text-ink/80'}`}>
                  {c.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <nav aria-label="Size" className="space-y-4">
        <h2 className={heading}>Size</h2>
        <ul className="grid grid-cols-3 gap-2">
          {sizes.map((s) => {
            const active = filters.size === s
            return (
              <li key={s ?? 'all'} className={s === 'OS' || s === null ? 'col-span-3' : ''}>
                <Link
                  href={shopHref({ ...filters, size: s })}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-11 items-center justify-center border font-mono text-xs uppercase tracking-[0.1em] transition-colors ${active ? 'border-ink bg-ink text-paper' : 'border-hairline bg-card hover:border-ink'}`}
                >
                  {s ? sizeLabel(s) : 'All sizes'}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
