import Link from 'next/link'
import { adminHeader, adminTitle } from '@/components/admin/admin-ui'
import { ProductForm } from '@/components/admin/product-form'
import { monoLabel } from '@/components/ui/styles'

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div className={adminHeader}>
        <div className="space-y-1">
          <p className={`${monoLabel} text-muted`}><Link href="/admin/products" className="underline-offset-4 hover:underline">Products</Link> / <span className="text-ink">New</span></p>
          <h1 className={adminTitle}>Add product</h1>
        </div>
      </div>
      <ProductForm product={null} />
    </div>
  )
}
