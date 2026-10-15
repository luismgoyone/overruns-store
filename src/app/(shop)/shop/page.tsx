import type { Metadata } from 'next'
import { ProductGrid } from '@/components/catalog/product-grid'
import { ShopFilters, ShopSidebar, ShopSort } from '@/components/catalog/shop-filters'
import { parseShopParams } from '@/lib/catalog/params'
import { listProducts } from '@/lib/catalog/queries'
import { createPublicClient } from '@/lib/supabase/public'

export const metadata: Metadata = { title: 'Shop' }

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseShopParams(await searchParams)
  const products = await listProducts(createPublicClient(), filters)
  const count = `${products.length} ${products.length === 1 ? 'item' : 'items'}`
  return (
    <>
      <div className="mx-4 flex items-end justify-between gap-4 border-b border-hairline pb-6 pt-8 sm:mx-8 lg:pt-12">
        <div className="space-y-2">
          <h1 className="flex flex-wrap items-baseline gap-x-3 font-display text-3xl lg:text-5xl">
            Shop <span className="font-mono text-xs font-normal tracking-[0.15em] text-muted sm:text-sm">{count}</span>
          </h1>
          <p className="text-sm text-muted sm:text-base">Authentic overruns from real brands. Limited sizes, below retail.</p>
        </div>
        <ShopSort filters={filters} />
      </div>
      <ShopFilters filters={filters} />
      <div className="pt-4 lg:grid lg:grid-cols-[220px_1fr] lg:gap-8 lg:px-8 lg:pt-8">
        <ShopSidebar filters={filters} />
        <ProductGrid products={products} className="px-4 lg:grid-cols-3 lg:px-0 xl:grid-cols-4" />
      </div>
    </>
  )
}
