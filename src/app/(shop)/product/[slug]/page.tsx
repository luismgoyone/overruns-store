import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { AddToCart } from '@/components/catalog/add-to-cart'
import { OverrunBadge } from '@/components/catalog/overrun-badge'
import { PriceTag } from '@/components/catalog/price-tag'
import { ProductGallery } from '@/components/catalog/product-gallery'
import { getProductBySlug } from '@/lib/catalog/queries'
import { SHIPPING_FEE_CENTAVOS } from '@/lib/config'
import { formatPeso } from '@/lib/money'
import { createPublicClient } from '@/lib/supabase/public'

export const revalidate = 60
type Props = { params: Promise<{ slug: string }> }

// Pages render on first visit and are then cached (ISR) instead of hitting Supabase every view.
export async function generateStaticParams() {
  return []
}

// Dedupes the lookup shared by generateMetadata and the page.
const loadProduct = cache((slug: string) => getProductBySlug(createPublicClient(), slug))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await loadProduct((await params).slug)
  return { title: product?.name ?? 'Product not found' }
}

export default async function ProductPage({ params }: Props) {
  const product = await loadProduct((await params).slug)
  if (!product) notFound()
  return (
    <div className="grid gap-6 px-4 pb-8 pt-4 sm:grid-cols-2 sm:pb-12">
      <ProductGallery images={product.images} name={product.name} />
      <div className="space-y-5">
        <OverrunBadge label="Limited stock" />
        <h1 className="font-display text-2xl leading-tight">{product.name}</h1>
        <PriceTag price={product.priceCentavos} retail={product.retailPriceCentavos} size="lg" />
        <AddToCart product={product} />
        <div className="divide-y divide-ink border-y border-ink">
          <details open className="py-3"><summary className="cursor-pointer font-semibold uppercase">Details</summary><p className="pt-2 text-muted">{product.description}</p></details>
          <details className="py-3"><summary className="cursor-pointer font-semibold uppercase">Sizing</summary><p className="pt-2 text-muted">Overruns follow the brand&apos;s own sizing. Message us on Instagram for measurements.</p></details>
          <details className="py-3"><summary className="cursor-pointer font-semibold uppercase">Shipping</summary><p className="pt-2 text-muted">Flat {formatPeso(SHIPPING_FEE_CENTAVOS)} nationwide. Ships within 2 business days of payment.</p></details>
        </div>
      </div>
    </div>
  )
}
