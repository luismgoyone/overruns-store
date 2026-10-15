import Link from 'next/link'
import { buttonPrimary } from '@/components/ui/styles'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listAllProducts } from '@/lib/catalog/queries'
import { totalStock } from '@/lib/catalog/stock'
import { formatPeso } from '@/lib/money'

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { supabase } = await requireAdmin()
  const [products, { saved }] = await Promise.all([listAllProducts(supabase), searchParams])
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Products</h1>
        <Link href="/admin/products/new" className={buttonPrimary}>Add product</Link>
      </div>
      {saved ? <p role="status" className="border border-ink bg-card p-3 text-sm">Saved.</p> : null}
      <table className="w-full border border-ink bg-card text-sm">
        <thead className="border-b border-ink text-left"><tr><th className="p-2">Name</th><th className="p-2">Price</th><th className="p-2">Stock</th><th className="p-2">Status</th></tr></thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b border-ink/20">
              <td className="p-2"><Link href={`/admin/products/${p.id}`} className="font-semibold underline">{p.name}</Link></td>
              <td className="p-2">{formatPeso(p.priceCentavos)}</td>
              <td className="p-2">{totalStock(p)} <span className="text-muted">({p.variants.map((v) => `${v.size}:${v.stock}`).join(' ')})</span></td>
              <td className="p-2">{p.isActive ? 'Visible' : <span className="text-muted">Hidden</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
