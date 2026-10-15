import { computeTotals } from '@/lib/cart/totals'
import type { CartPayloadLine } from './schema'
import type { CartProblem, DbVariant, PricedLine } from './types'

export type PriceCartResult =
  | { ok: true; lines: PricedLine[]; subtotal: number; shipping: number; total: number }
  | { ok: false; problems: CartProblem[] }

export function priceCart(requested: CartPayloadLine[], variants: DbVariant[], shippingFeeCentavos: number): PriceCartResult {
  const merged = new Map<string, { qty: number; seenPrice: number }>()
  for (const r of requested) {
    const prev = merged.get(r.variantId)
    merged.set(r.variantId, { qty: (prev?.qty ?? 0) + r.qty, seenPrice: r.priceCentavos })
  }
  const byId = new Map(variants.map((v) => [v.id, v]))
  const problems: CartProblem[] = []
  const lines: PricedLine[] = []

  for (const [variantId, { qty, seenPrice }] of merged) {
    const v = byId.get(variantId)
    const named = v ? { name: v.product.name, size: v.size } : {}
    if (!v || !v.product.isActive || v.stock <= 0) {
      problems.push({ variantId, reason: 'unavailable', available: 0, ...named })
    } else if (qty > v.stock) {
      problems.push({ variantId, reason: 'insufficient_stock', available: v.stock, ...named })
    } else if (seenPrice !== v.product.priceCentavos) {
      problems.push({ variantId, reason: 'price_changed', available: v.stock, currentPriceCentavos: v.product.priceCentavos, ...named })
    } else {
      lines.push({ variantId, productName: v.product.name, size: v.size, qty, priceCentavos: v.product.priceCentavos })
    }
  }

  if (problems.length > 0) return { ok: false, problems }
  const subtotal = lines.reduce((n, l) => n + l.qty * l.priceCentavos, 0)
  return { ok: true, lines, ...computeTotals(subtotal, shippingFeeCentavos) }
}
