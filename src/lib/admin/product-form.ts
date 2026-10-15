import { CATEGORIES, SIZES, type Category, type Size } from '@/lib/catalog/constants'

export const MAX_IMAGES = 8
export const MAX_PRICE_CENTAVOS = 100_000_000
export const MAX_DESCRIPTION_LENGTH = 2000

const STORAGE_PATH = /^products\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/
// Demo photos shipped in public/ for the seeded products.
const DEMO_PATH = /^\/demo\/products\/[a-z0-9-]+\.jpg$/
const REMOTE_IMAGE_HOSTS = ['picsum.photos', 'fastly.picsum.photos']

export function isAllowedImage(src: string): boolean {
  if (STORAGE_PATH.test(src) || DEMO_PATH.test(src)) return true
  if (!src.startsWith('https://')) return false
  let host: string
  try {
    host = new URL(src).host
  } catch {
    return false
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : null
  return REMOTE_IMAGE_HOSTS.includes(host) || host === supabaseHost
}

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
  /** Stock per size when the form was loaded; the save applies (stock - orig) to the live value. */
  stockOrig: Partial<Record<Size, number>>
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
  else if (priceCentavos > MAX_PRICE_CENTAVOS) errors.price = 'Price can be at most ₱1,000,000.'

  const retailRaw = str('retailPrice')
  const retailPriceCentavos = retailRaw ? parsePesoToCentavos(retailRaw) : null
  if (retailRaw && retailPriceCentavos === null) errors.retailPrice = 'Enter a retail price in pesos, or leave it blank.'
  else if (retailPriceCentavos !== null && retailPriceCentavos > MAX_PRICE_CENTAVOS) errors.retailPrice = 'Retail price can be at most ₱1,000,000.'
  else if (retailPriceCentavos !== null && priceCentavos && retailPriceCentavos <= priceCentavos) errors.retailPrice = 'Retail price must be higher than the overrun price.'

  const description = str('description')
  if (description.length > MAX_DESCRIPTION_LENGTH) errors.description = `Description can be at most ${MAX_DESCRIPTION_LENGTH} characters.`

  let images: string[] = []
  try {
    const parsed: unknown = JSON.parse(str('images') || '[]')
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string' && isAllowedImage(p))) images = parsed.slice(0, MAX_IMAGES)
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
  const stockOrig: Partial<Record<Size, number>> = {}
  for (const size of SIZES) {
    const raw = str(`stock_orig_${size}`)
    if (/^\d{1,5}$/.test(raw)) stockOrig[size] = Number(raw)
  }
  if (Object.keys(stock).length === 0 && !Object.keys(errors).some((k) => k.startsWith('stock_'))) errors.stock = 'Enter stock for at least one size (0 is fine).'

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors }
  return {
    ok: true,
    data: {
      name, slug, description, category: category!, priceCentavos: priceCentavos!, retailPriceCentavos,
      images, isActive: fd.get('isActive') === 'on', isFeatured: fd.get('isFeatured') === 'on', stock, stockOrig,
    },
  }
}
