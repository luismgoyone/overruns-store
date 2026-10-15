import type { OrderStatus } from '@/lib/catalog/constants'

/** The webhook usually lands within seconds; after this, the order page asks PayMongo directly. */
export const RECONCILE_AFTER_MS = 30_000

export function shouldReconcile(order: { status: OrderStatus; createdAt: string }, { now = Date.now(), hasKey }: { now?: number; hasKey: boolean }): boolean {
  return hasKey && order.status === 'pending' && now - Date.parse(order.createdAt) > RECONCILE_AFTER_MS
}

/**
 * When the order page may empty the cart: always once paid; while pending only if this tab just came
 * back from this order's PayMongo checkout (sessionStorage marker); never for a cancelled order.
 */
export function cartClearMode(status: OrderStatus): 'always' | 'if-marker' | 'never' {
  if (status === 'paid' || status === 'shipped') return 'always'
  return status === 'pending' ? 'if-marker' : 'never'
}

const lastAttempt = new Map<string, number>()
export const RECONCILE_GAP_MS = 10_000

/** Per-instance throttle so a refreshing order page asks PayMongo at most every 10s per order. */
export function takeReconcileSlot(orderId: string, now = Date.now()): boolean {
  const last = lastAttempt.get(orderId)
  if (last !== undefined && now - last < RECONCILE_GAP_MS) return false
  if (lastAttempt.size > 1000) lastAttempt.clear()
  lastAttempt.set(orderId, now)
  return true
}
