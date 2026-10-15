import type { Product } from '@/lib/catalog/types'
import { ProductCard } from './product-card'

export function ProductGrid({ products, className = 'px-4 sm:px-8 lg:grid-cols-4' }: { products: Product[]; className?: string }) {
  if (products.length === 0) return <p className="px-4 py-16 text-center font-mono text-sm uppercase tracking-[0.15em] text-muted">No products match. Try another size or category.</p>
  return (
    <ul className={`grid grid-cols-2 gap-3 sm:gap-4 ${className}`}>
      {products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
    </ul>
  )
}
