import type { Database } from '@/lib/supabase/database.types'

export type Size = Database['public']['Enums']['product_size']
export type Category = Database['public']['Enums']['product_category']
export type OrderStatus = Database['public']['Enums']['order_status']

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS'] as const satisfies readonly Size[]

export const CATEGORIES = [
  { slug: 'tops', label: 'Tops' },
  { slug: 'bottoms', label: 'Bottoms' },
  { slug: 'outerwear', label: 'Outerwear' },
  { slug: 'kids', label: 'Kids' },
  { slug: 'accessories', label: 'Accessories' },
] as const satisfies readonly { slug: Category; label: string }[]

export function sizeLabel(size: Size): string {
  return size === 'OS' ? 'One size' : size
}
