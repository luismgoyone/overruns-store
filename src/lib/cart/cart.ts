import { z } from 'zod'
import { SIZES, type Size } from '@/lib/catalog/constants'

export const CART_STORAGE_KEY = 'overruns-cart-v1'
export const MAX_QTY_PER_LINE = 10

export type CartLine = {
  variantId: string
  productId: string
  slug: string
  name: string
  size: Size
  priceCentavos: number
  image: string | null
  qty: number
  maxQty: number
}

export type CartState = { lines: CartLine[]; hydrated: boolean }
export const EMPTY_CART: CartState = { lines: [], hydrated: false }

export type CartAction =
  | { type: 'add'; line: Omit<CartLine, 'qty'>; qty?: number }
  | { type: 'setQty'; variantId: string; qty: number }
  | { type: 'remove'; variantId: string }
  | { type: 'clear' }
  | { type: 'hydrate'; lines: CartLine[] }

const clampQty = (qty: number, maxQty: number) => Math.max(0, Math.min(Math.floor(qty), maxQty, MAX_QTY_PER_LINE))

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      if (action.line.maxQty <= 0) return state
      const existing = state.lines.find((l) => l.variantId === action.line.variantId)
      const wanted = (existing?.qty ?? 0) + (action.qty ?? 1)
      const next: CartLine = { ...action.line, qty: clampQty(wanted, action.line.maxQty) }
      const lines = existing
        ? state.lines.map((l) => (l.variantId === next.variantId ? next : l))
        : [...state.lines, next]
      return { ...state, lines }
    }
    case 'setQty': {
      const lines = state.lines
        .map((l) => (l.variantId === action.variantId ? { ...l, qty: clampQty(action.qty, l.maxQty) } : l))
        .filter((l) => l.qty > 0)
      return { ...state, lines }
    }
    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.variantId !== action.variantId) }
    case 'clear':
      return { ...state, lines: [] }
    case 'hydrate':
      return { lines: action.lines, hydrated: true }
  }
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0)
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty * l.priceCentavos, 0)

const storedLineSchema = z.object({
  variantId: z.string().min(1),
  productId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  size: z.enum(SIZES),
  priceCentavos: z.number().int().nonnegative(),
  image: z.string().nullable(),
  qty: z.number().int().positive(),
  maxQty: z.number().int().positive(),
})

export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  return data.flatMap((item) => {
    const parsed = storedLineSchema.safeParse(item)
    if (!parsed.success) return []
    const qty = clampQty(parsed.data.qty, parsed.data.maxQty)
    return qty > 0 ? [{ ...parsed.data, qty }] : []
  })
}
