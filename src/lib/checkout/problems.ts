import { formatPeso } from '@/lib/money'
import type { CartProblem } from './types'

export function problemMessage(p: CartProblem): string {
  if (!p.name || !p.size) return 'An item in your cart is no longer available.'
  const item = p.size === 'OS' ? p.name : `${p.name} (${p.size})`
  switch (p.reason) {
    case 'unavailable': return `${item} is sold out.`
    case 'insufficient_stock': return `Only ${p.available} left of ${item}.`
    case 'price_changed': return `${item} is now ${formatPeso(p.currentPriceCentavos ?? 0)}.`
  }
}
