import type { Database } from '@/lib/supabase/database.types'
import { SIZES, type Size } from './constants'
import type { Product } from './types'

type Tables = Database['public']['Tables']

export const PRODUCT_SELECT =
  'id, slug, name, description, category, price_centavos, retail_price_centavos, images, is_active, is_featured, created_at, product_variants(id, size, stock)' as const

export type ProductRow = Tables['products']['Row'] & {
  product_variants: Pick<Tables['product_variants']['Row'], 'id' | 'size' | 'stock'>[]
}

const sizeOrder = (s: Size) => SIZES.indexOf(s)

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    priceCentavos: row.price_centavos,
    retailPriceCentavos: row.retail_price_centavos,
    images: row.images,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    createdAt: row.created_at,
    variants: [...row.product_variants]
      .sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size))
      .map((v) => ({ id: v.id, size: v.size, stock: v.stock })),
  }
}

export function filterBySize(products: Product[], size: Size | null): Product[] {
  if (!size) return products
  return products.filter((p) => p.variants.some((v) => v.size === size && v.stock > 0))
}
