import Image from 'next/image'
import Link from 'next/link'
import { adminHeader, adminTitle, table, td, th } from '@/components/admin/admin-ui'
import { buttonPrimary, monoLabel } from '@/components/ui/styles'
import { requireAdmin } from '@/lib/auth/require-admin'
import { CATEGORIES, sizeLabel } from '@/lib/catalog/constants'
import { productImageUrl } from '@/lib/catalog/images'
import { listAllProducts } from '@/lib/catalog/queries'
import { totalStock } from '@/lib/catalog/stock'
import type { Product } from '@/lib/catalog/types'
import { formatPeso } from '@/lib/money'

const badge = 'inline-block border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] whitespace-nowrap'

function ProductStatus({ product }: { product: Product }) {
  if (!product.isActive) return <span className={`${badge} border-ink bg-card text-ink`}>Hidden</span>
  if (totalStock(product) === 0) return <span className={`${badge} border-hairline bg-paper text-muted`}>Sold out</span>
  return <span className={`${badge} border-ink bg-ink text-paper`}>Active</span>
}

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { supabase } = await requireAdmin()
  const [products, { saved }] = await Promise.all([listAllProducts(supabase), searchParams])
  return (
    <div className="space-y-6">
      <div className={adminHeader}>
        <div className="space-y-1">
          <p className={`${monoLabel} text-muted`}>{products.length} {products.length === 1 ? 'product' : 'products'}</p>
          <h1 className={adminTitle}>Products</h1>
        </div>
        <Link href="/admin/products/new" className={buttonPrimary}>+ Add product</Link>
      </div>
      {saved ? <p role="status" className="border border-ink bg-card p-3 text-sm">Saved.</p> : null}
      <div className="overflow-x-auto">
        <table className={`${table} min-w-[760px]`}>
          <thead>
            <tr>
              <th className={th}><span className="sr-only">Photo</span></th>
              <th className={th}>Name</th>
              <th className={th}>Category</th>
              <th className={th}>Price</th>
              <th className={th}>Stock</th>
              <th className={th}>Status</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {products.map((p) => {
              const stock = totalStock(p)
              const muted = !p.isActive || stock === 0
              return (
                <tr key={p.id} className="hover:bg-paper/60">
                  <td className={`${td} w-16`}>
                    <div className="relative h-12 w-12 border border-hairline bg-paper">
                      {p.images[0] ? <Image src={productImageUrl(p.images[0])} alt="" fill sizes="48px" className="object-cover" /> : null}
                    </div>
                  </td>
                  <td className={td}>
                    <Link href={`/admin/products/${p.id}`} className="font-display text-sm uppercase underline-offset-4 hover:underline">{p.name}</Link>
                    <p className="font-mono text-[11px] text-muted">/{p.slug}</p>
                  </td>
                  <td className={`${td} font-mono text-xs uppercase tracking-[0.1em] text-muted`}>{CATEGORIES.find((c) => c.slug === p.category)?.label ?? p.category}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <span className="font-bold">{formatPeso(p.priceCentavos)}</span>
                    {p.retailPriceCentavos ? <s className="block text-xs text-muted">{formatPeso(p.retailPriceCentavos)}</s> : null}
                  </td>
                  <td className={`${td} font-mono text-xs ${muted ? 'text-muted' : ''}`}>
                    <span className="font-bold">{stock}</span>
                    <span className="block text-muted">{p.variants.map((v) => `${sizeLabel(v.size)} ${v.stock}`).join(' · ') || 'No sizes'}</span>
                  </td>
                  <td className={td}><ProductStatus product={p} /></td>
                  <td className={`${td} text-right`}>
                    <Link href={`/admin/products/${p.id}`} aria-label={`Edit ${p.name}`} className="inline-flex h-11 items-center border border-ink bg-card px-4 font-mono text-xs uppercase tracking-[0.15em] hover:bg-ink hover:text-paper">Edit</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
