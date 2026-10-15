import { notFound } from 'next/navigation'
import { ProductForm } from '@/components/admin/product-form'
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
      <h1 className="font-display text-2xl">Edit {product.name}</h1>
      <ProductForm product={product} />
    </div>
  )
}
