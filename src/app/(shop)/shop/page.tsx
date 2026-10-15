import type { Metadata } from 'next'
import { ProductGrid } from '@/components/catalog/product-grid'
import { ShopFilters } from '@/components/catalog/shop-filters'
import { parseShopParams } from '@/lib/catalog/params'
import { listProducts } from '@/lib/catalog/queries'
import { createPublicClient } from '@/lib/supabase/public'

export const metadata: Metadata = { title: 'Shop' }

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseShopParams(await searchParams)
  const products = await listProducts(createPublicClient(), filters)
  return (
    <>
      <h1 className="px-4 pb-2 pt-6 font-display text-2xl">Shop</h1>
      <ShopFilters filters={filters} />
      <p className="px-4 py-3 text-sm text-muted">{products.length} {products.length === 1 ? 'item' : 'items'}</p>
      <ProductGrid products={products} />
    </>
  )
}
