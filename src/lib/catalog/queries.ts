import type { Db } from '@/lib/supabase/server'
import { filterBySize, PRODUCT_SELECT, toProduct, type ProductRow } from './mappers'
import type { ShopFilters } from './params'
import type { Product } from './types'

function rows(data: unknown): Product[] {
  return (data as ProductRow[]).map(toProduct)
}

export async function listProducts(db: Db, { category, size, sort }: ShopFilters): Promise<Product[]> {
  let query = db.from('products').select(PRODUCT_SELECT).eq('is_active', true)
  if (category) query = query.eq('category', category)
  query =
    sort === 'price-asc'
      ? query.order('price_centavos', { ascending: true })
      : sort === 'price-desc'
        ? query.order('price_centavos', { ascending: false })
        : query.order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) throw error
  // Size filtering happens in JS so each card keeps its full variant list for stock labels.
  return filterBySize(rows(data), size)
}

export async function listLatest(db: Db, limit = 6): Promise<Product[]> {
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).eq('is_active', true).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return rows(data)
}

export async function listFeatured(db: Db, limit = 4): Promise<Product[]> {
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).eq('is_active', true).eq('is_featured', true).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return rows(data)
}

export async function getProductBySlug(db: Db, slug: string): Promise<Product | null> {
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).eq('slug', slug).eq('is_active', true).maybeSingle()
  if (error) throw error
  return data ? toProduct(data as ProductRow) : null
}

export async function getProductById(db: Db, id: string): Promise<Product | null> {
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toProduct(data as ProductRow) : null
}

export async function listAllProducts(db: Db): Promise<Product[]> {
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).order('created_at', { ascending: false })
  if (error) throw error
  return rows(data)
}
