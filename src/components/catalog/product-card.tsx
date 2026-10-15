import Image from 'next/image'
import Link from 'next/link'
import { productImageUrl } from '@/lib/catalog/images'
import { lowStockLabel, totalStock } from '@/lib/catalog/stock'
import type { Product } from '@/lib/catalog/types'
import { OverrunBadge } from './overrun-badge'
import { PriceTag } from './price-tag'

export function ProductCard({ product }: { product: Product }) {
  const stock = totalStock(product)
  const soldOut = stock === 0
  const low = lowStockLabel(stock)
  const cover = product.images[0]
  return (
    <Link href={`/product/${product.slug}`} className="group block border border-ink bg-card">
      <div className="relative aspect-square overflow-hidden border-b border-ink bg-paper">
        {cover ? (
          <Image src={productImageUrl(cover)} alt={product.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform group-hover:scale-[1.02]" />
        ) : null}
        <OverrunBadge className="absolute left-0 top-3" />
        {soldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-paper/70">
            <span className="border border-ink bg-card px-3 py-1 font-display text-xs">Sold out</span>
          </div>
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <h3 className="text-sm leading-snug">{product.name}</h3>
        <PriceTag price={product.priceCentavos} retail={product.retailPriceCentavos} />
        {!soldOut && low ? <p className="inline-block bg-tag px-1.5 text-[11px] font-bold uppercase text-ink">{low}</p> : null}
      </div>
    </Link>
  )
}
