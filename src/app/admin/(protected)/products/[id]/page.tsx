import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminHeader, adminTitle } from '@/components/admin/admin-ui'
import { ProductForm } from '@/components/admin/product-form'
import { monoLabel } from '@/components/ui/styles'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getProductById } from '@/lib/catalog/queries'
import { isUuid } from '@/lib/orders/queries'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { supabase } = await requireAdmin()
  const product = await getProductById(supabase, id)
  if (!product) notFound()
  return (
    <div className="space-y-6">
      <div className={adminHeader}>
        <div className="space-y-1">
          <p className={`${monoLabel} text-muted`}><Link href="/admin/products" className="underline-offset-4 hover:underline">Products</Link> / <span className="text-ink">{product.name}</span></p>
          <h1 className={adminTitle}>Edit product</h1>
        </div>
      </div>
      <ProductForm product={product} />
    </div>
  )
}
