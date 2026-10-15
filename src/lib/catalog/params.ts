import { CATEGORIES, SIZES, type Category, type Size } from './constants'

export type ShopSort = 'newest' | 'price-asc' | 'price-desc'
export type ShopFilters = { category: Category | null; size: Size | null; sort: ShopSort }
type SearchParams = Record<string, string | string[] | undefined>

function first(sp: SearchParams, key: string): string | undefined {
  const v = sp[key]
  return Array.isArray(v) ? v[0] : v
}

export function parseShopParams(sp: SearchParams): ShopFilters {
  const categoryRaw = first(sp, 'category')
  const category = CATEGORIES.find((c) => c.slug === categoryRaw)?.slug ?? null
  const sizeRaw = first(sp, 'size')?.toUpperCase() ?? ''
  const size = (SIZES as readonly string[]).includes(sizeRaw) ? (sizeRaw as Size) : null
  const sortRaw = first(sp, 'sort')
  const sort: ShopSort = sortRaw === 'price-asc' || sortRaw === 'price-desc' ? sortRaw : 'newest'
  return { category, size, sort }
}
