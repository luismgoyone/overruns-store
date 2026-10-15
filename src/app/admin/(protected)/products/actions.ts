'use server'

import { redirect } from 'next/navigation'
import { parseProductForm } from '@/lib/admin/product-form'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { Size } from '@/lib/catalog/constants'
import { revalidateCatalog } from '@/lib/catalog/revalidate'

export type ProductFormState =
  | { status: 'idle' }
  | { status: 'invalid'; fieldErrors: Record<string, string>; values: Record<string, string> }
  | { status: 'error'; message: string; values: Record<string, string> }

// Echoed back so React 19's post-action form reset doesn't wipe the owner's input. Images live in ImageUploader state.
function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [k, v] of formData.entries()) if (typeof v === 'string' && k !== 'images' && !k.startsWith('$')) values[k] = v
  return values
}

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '') || null
  const values = formValues(formData)
  const parsed = parseProductForm(formData)
  if (!parsed.ok) return { status: 'invalid', fieldErrors: parsed.fieldErrors, values }
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
    if (error.code === '23505') return { status: 'invalid', fieldErrors: { slug: 'Another product already uses this slug.' }, values }
    return { status: 'error', message: error.message, values }
  }

  // One transaction: existing sizes move by (new - loaded) so concurrent sales aren't overwritten;
  // removed sizes still held by open orders drop to 0 instead of being deleted.
  const sizes = Object.keys(p.stock) as Size[]
  const { error: stockError } = await supabase.rpc('save_product_stock', {
    p_product_id: saved.id,
    p_stock: sizes.map((size) => ({ size, stock: p.stock[size]!, orig: p.stockOrig[size] ?? null })),
  })
  if (stockError) return { status: 'error', message: stockError.message, values }

  revalidateCatalog()
  redirect('/admin/products?saved=1')
}
