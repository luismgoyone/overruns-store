import { CATEGORIES, SIZES, type Category, type Size } from '@/lib/catalog/constants'

export const MAX_IMAGES = 8

export function parsePesoToCentavos(input: string): number | null {
  const s = input.replace(/[₱,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

export function centavosToPesoInput(c: number | null): string {
  if (c === null) return ''
  return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2)
}

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}

export type ProductInput = {
  name: string
  slug: string
  description: string
  category: Category
  priceCentavos: number
  retailPriceCentavos: number | null
  images: string[]
  isActive: boolean
  isFeatured: boolean
  stock: Partial<Record<Size, number>>
}

export function parseProductForm(fd: FormData): { ok: true; data: ProductInput } | { ok: false; fieldErrors: Record<string, string> } {
  const str = (k: string) => String(fd.get(k) ?? '').trim()
  const errors: Record<string, string> = {}

  const name = str('name')
  if (name.length < 1 || name.length > 120) errors.name = 'Name is required (max 120 characters).'
  const slug = slugify(str('slug') || name)
  if (name && !slug) errors.slug = 'Use letters or numbers in the name or slug.'

  const categoryRaw = str('category')
  const category = CATEGORIES.find((c) => c.slug === categoryRaw)?.slug
  if (!category) errors.category = 'Pick a category.'

  const priceCentavos = parsePesoToCentavos(str('price'))
  if (!priceCentavos) errors.price = 'Enter a price in pesos, like 690 or 1,299.50.'

  const retailRaw = str('retailPrice')
  const retailPriceCentavos = retailRaw ? parsePesoToCentavos(retailRaw) : null
  if (retailRaw && retailPriceCentavos === null) errors.retailPrice = 'Enter a retail price in pesos, or leave it blank.'
  else if (retailPriceCentavos !== null && priceCentavos && retailPriceCentavos <= priceCentavos) errors.retailPrice = 'Retail price must be higher than the overrun price.'

  let images: string[] = []
  try {
    const parsed: unknown = JSON.parse(str('images') || '[]')
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) images = parsed.slice(0, MAX_IMAGES)
    else errors.images = 'Image list is invalid. Reload and try again.'
  } catch {
    errors.images = 'Image list is invalid. Reload and try again.'
  }

  const stock: Partial<Record<Size, number>> = {}
  for (const size of SIZES) {
    const raw = str(`stock_${size}`)
    if (raw === '') continue
    if (!/^\d{1,5}$/.test(raw)) errors[`stock_${size}`] = 'Whole number, 0 or more.'
    else stock[size] = Number(raw)
  }
  if (Object.keys(stock).length === 0 && !Object.keys(errors).some((k) => k.startsWith('stock_'))) errors.stock = 'Enter stock for at least one size (0 is fine).'

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors }
  return {
    ok: true,
    data: {
      name, slug, description: str('description'), category: category!, priceCentavos: priceCentavos!, retailPriceCentavos,
      images, isActive: fd.get('isActive') === 'on', isFeatured: fd.get('isFeatured') === 'on', stock,
    },
  }
}
