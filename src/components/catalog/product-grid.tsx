import type { Product } from '@/lib/catalog/types'
import { ProductCard } from './product-card'

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) return <p className="px-4 py-10 text-center text-muted">No products match. Try another size or category.</p>
  return (
    <ul className="grid grid-cols-2 gap-3 px-4 lg:grid-cols-4">
      {products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
    </ul>
  )
}
