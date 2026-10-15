import Link from 'next/link'
import { CATEGORIES } from '@/lib/catalog/constants'

const chip = 'inline-flex h-11 shrink-0 items-center border px-4 font-mono text-xs uppercase tracking-[0.15em] transition-colors'

export function CategoryChips() {
  return (
    <nav aria-label="Categories" className="mx-4 flex items-center gap-2 overflow-x-auto border-y border-hairline py-4 [scrollbar-width:none] sm:mx-8">
      <span className="hidden shrink-0 pr-2 font-mono text-xs uppercase tracking-[0.15em] text-muted sm:inline">Filter:</span>
      <Link href="/shop" className={`${chip} border-muted bg-card hover:border-ink`}>All categories</Link>
      {CATEGORIES.map((c) => (
        <Link key={c.slug} href={`/shop?category=${c.slug}`} className={`${chip} border-muted bg-card hover:border-ink`}>
          {c.label}
        </Link>
      ))}
    </nav>
  )
}
