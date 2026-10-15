import type { Product, Variant } from './types'

export const LOW_STOCK_THRESHOLD = 3

export const totalStock = (p: Product) => p.variants.reduce((n, v) => n + v.stock, 0)

export function lowStockLabel(stock: number): string | null {
  return stock > 0 && stock <= LOW_STOCK_THRESHOLD ? `Only ${stock} left` : null
}

export function sizeStockNote(v: Variant): string | null {
  const label = lowStockLabel(v.stock)
  if (!label) return null
  return v.size === 'OS' ? label : `${label} in ${v.size}`
}
