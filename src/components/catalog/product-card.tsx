import Image from 'next/image'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/catalog/constants'
import { productImageUrl } from '@/lib/catalog/images'
import { lowStockLabel, totalStock } from '@/lib/catalog/stock'
import type { Product } from '@/lib/catalog/types'
import { OverrunBadge } from './overrun-badge'
import { percentOff, PriceTag } from './price-tag'

export function ProductCard({ product }: { product: Product }) {
  const stock = totalStock(product)
  const soldOut = stock === 0
  const low = lowStockLabel(stock)
  const cover = product.images[0]
  const off = percentOff(product.priceCentavos, product.retailPriceCentavos)
  const category = CATEGORIES.find((c) => c.slug === product.category)?.label ?? product.category
  return (
    <Link href={`/product/${product.slug}`} className="group flex h-full flex-col border border-hairline bg-card transition-colors hover:border-ink">
      <div className="relative aspect-square overflow-hidden bg-paper">
        {cover ? (
          <Image src={productImageUrl(cover)} alt={product.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className={`object-cover transition-transform duration-300 group-hover:scale-[1.03] ${soldOut ? 'grayscale' : ''}`} />
        ) : null}
        <OverrunBadge className={`absolute left-2 top-2 ${soldOut ? 'opacity-40' : ''}`} />
        {soldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-paper/60">
            <span className="bg-ink px-3 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-paper">Sold out</span>
          </div>
        ) : null}
      </div>
      <div className={`flex flex-1 flex-col gap-1.5 border-t border-hairline p-3 ${soldOut ? 'text-muted' : ''}`}>
        <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.15em] sm:text-[11px]">
          <span className="truncate text-muted">{category}</span>
          {off && !soldOut ? <span className="shrink-0 font-bold text-tag-ink">{off}% off</span> : null}
        </div>
        <h3 className="line-clamp-2 font-display text-sm font-medium uppercase leading-snug tracking-tight">{product.name}</h3>
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 pt-1">
          <PriceTag price={product.priceCentavos} retail={product.retailPriceCentavos} />
          {!soldOut && low ? <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-tag-ink sm:text-[11px]">{low}</p> : null}
        </div>
      </div>
    </Link>
  )
}
