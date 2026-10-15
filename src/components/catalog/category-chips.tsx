import Link from 'next/link'
import { CATEGORIES } from '@/lib/catalog/constants'

export function CategoryChips() {
  return (
    <nav aria-label="Categories" className="flex gap-2 overflow-x-auto px-4 py-4 [scrollbar-width:none]">
      {CATEGORIES.map((c) => (
        <Link key={c.slug} href={`/shop?category=${c.slug}`} className="inline-flex h-11 shrink-0 items-center border border-ink bg-card px-4 text-sm font-semibold uppercase hover:bg-ink hover:text-paper">
          {c.label}
        </Link>
      ))}
    </nav>
  )
}
