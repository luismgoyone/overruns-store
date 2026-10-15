'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { parseProductForm } from '@/lib/admin/product-form'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { Size } from '@/lib/catalog/constants'

export type ProductFormState = { status: 'idle' } | { status: 'invalid'; fieldErrors: Record<string, string> } | { status: 'error'; message: string }

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '') || null
  const parsed = parseProductForm(formData)
  if (!parsed.ok) return { status: 'invalid', fieldErrors: parsed.fieldErrors }
  const p = parsed.data

  const row = {
    slug: p.slug, name: p.name, description: p.description, category: p.category,
    price_centavos: p.priceCentavos, retail_price_centavos: p.retailPriceCentavos, images: p.images,
    is_active: p.isActive, is_featured: p.isFeatured,
  }
  const { data: saved, error } = id
    ? await supabase.from('products').update(row).eq('id', id).select('id').single()
    : await supabase.from('products').insert(row).select('id').single()
  if (error) {
    if (error.code === '23505') return { status: 'invalid', fieldErrors: { slug: 'Another product already uses this slug.' } }
    return { status: 'error', message: error.message }
  }

  const sizes = Object.keys(p.stock) as Size[]
  const { error: upsertError } = await supabase
    .from('product_variants')
    .upsert(sizes.map((size) => ({ product_id: saved.id, size, stock: p.stock[size]! })), { onConflict: 'product_id,size' })
  if (upsertError) return { status: 'error', message: upsertError.message }
  const { error: deleteError } = await supabase.from('product_variants').delete().eq('product_id', saved.id).not('size', 'in', `(${sizes.join(',')})`)
  if (deleteError) return { status: 'error', message: deleteError.message }

  revalidatePath('/')
  revalidatePath('/shop')
  revalidatePath('/product/[slug]', 'page')
  redirect('/admin/products?saved=1')
}
