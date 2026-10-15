import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { AddToCart } from '@/components/catalog/add-to-cart'
import { OverrunBadge } from '@/components/catalog/overrun-badge'
import { percentOff, PriceTag } from '@/components/catalog/price-tag'
import { ProductGallery } from '@/components/catalog/product-gallery'
import { monoLabel } from '@/components/ui/styles'
import { CATEGORIES } from '@/lib/catalog/constants'
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

const summary = "flex cursor-pointer list-none items-center justify-between py-5 font-display text-lg [&::-webkit-details-marker]:hidden after:font-sans after:text-2xl after:font-light after:content-['+'] group-open:after:content-['−']"

export default async function ProductPage({ params }: Props) {
  const product = await loadProduct((await params).slug)
  if (!product) notFound()
  const off = percentOff(product.priceCentavos, product.retailPriceCentavos)
  const category = CATEGORIES.find((c) => c.slug === product.category)?.label ?? product.category
  return (
    <div className="grid gap-6 pb-8 sm:grid-cols-2 sm:gap-10 sm:px-8 sm:pb-12 sm:pt-8 lg:gap-16">
      <div className="relative sm:sticky sm:top-24 sm:self-start">
        <ProductGallery images={product.images} name={product.name} />
        <OverrunBadge className="absolute left-3 top-3" />
      </div>
      <div className="space-y-6 px-4 sm:px-0">
        <div className="space-y-3">
          <div className={`flex justify-between gap-4 ${monoLabel} text-muted`}>
            <span>{category}</span>
            <span className="font-bold text-tag-ink">Limited stock</span>
          </div>
          <h1 className="font-display text-3xl leading-tight lg:text-4xl">{product.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <PriceTag price={product.priceCentavos} retail={product.retailPriceCentavos} size="lg" />
            {off ? <span className="border border-tag bg-tag/10 px-2 py-1 font-mono text-xs font-bold uppercase tracking-[0.1em] text-tag-ink">−{off}% off retail</span> : null}
          </div>
        </div>
        <div className="border-t border-hairline pt-6">
          <AddToCart product={product} />
        </div>
        <div className="divide-y divide-hairline border-y border-hairline">
          <details open className="group"><summary className={summary}>Details</summary><p className="whitespace-pre-line pb-5 text-muted">{product.description}</p></details>
          <details className="group"><summary className={summary}>Sizing</summary><p className="pb-5 text-muted">Overruns follow the brand&apos;s own sizing. Message us on Instagram for measurements.</p></details>
          <details className="group"><summary className={summary}>Shipping</summary><p className="pb-5 text-muted">Flat {formatPeso(SHIPPING_FEE_CENTAVOS)} nationwide. Ships within 2 business days of payment.</p></details>
        </div>
      </div>
    </div>
  )
}
