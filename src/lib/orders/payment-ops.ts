import type { OrderStatus } from '@/lib/catalog/constants'
import { SessionActiveError, type CheckoutSessionInfo } from '@/lib/paymongo/client'
import { afterPayment, type AfterPaymentDeps, type PaymentInfo, type PaymentRecord } from './payments'

/** livemode: mode of the key that created the session (null for orders from before it was recorded). */
export type OrderPaymentState = { id: string; status: OrderStatus; checkoutId: string | null; livemode: boolean | null; createdAt: string }

export type PaymentOpsDeps = AfterPaymentDeps & {
  /** Mode of the configured PayMongo key (null when unknown). */
  currentLivemode: boolean | null
  getOrder(orderId: string): Promise<OrderPaymentState | null>
  /** GET /checkout_sessions/{id}; throws on PayMongo errors. */
  getSession(checkoutId: string): Promise<CheckoutSessionInfo>
  /** Closes the session: 'expired' (now or already) or 'paid'; throws when PayMongo can't confirm either. */
  expireSession(checkoutId: string): Promise<'expired' | 'paid'>
  /** record_checkout_payment: idempotent, same path as the webhook. */
  recordPayment(checkoutId: string, info: PaymentInfo): Promise<PaymentRecord>
  /** Cancels only if still pending; true when it did. */
  cancelOrder(orderId: string): Promise<boolean>
}

export type ReconcileResult = 'paid' | 'pending' | 'not_pending' | 'no_session' | 'not_found' | 'other_mode' | 'error'

/**
 * A session made with a test key can't be seen (or paid into this account) with a live key, and vice versa.
 * After switching keys, such orders are treated as not payable here: reconcile skips them, cancel skips PayMongo.
 */
const otherMode = (order: OrderPaymentState, deps: PaymentOpsDeps) =>
  order.livemode !== null && deps.currentLivemode !== null && order.livemode !== deps.currentLivemode

async function recordAndNotify(checkoutId: string, info: PaymentInfo, source: string, deps: PaymentOpsDeps) {
  const r = await deps.recordPayment(checkoutId, info)
  await afterPayment(r, { checkoutId, source }, deps)
  return r
}

/** Asks PayMongo whether a pending order was paid (for when the webhook never arrived). Never throws. */
export async function reconcileOrderCore(orderId: string, deps: PaymentOpsDeps, source = 'reconcile'): Promise<ReconcileResult> {
  try {
    const order = await deps.getOrder(orderId)
    if (!order) return 'not_found'
    if (order.status !== 'pending') return 'not_pending'
    if (!order.checkoutId) return 'no_session'
    if (otherMode(order, deps)) return 'other_mode'
    let session: CheckoutSessionInfo
    try {
      session = await deps.getSession(order.checkoutId)
    } catch (err) {
      console.warn(`[${source}] could not reach PayMongo`, { orderId, err })
      return 'error'
    }
    if (!session.paid) return 'pending'
    const r = await recordAndNotify(order.checkoutId, { paidCentavos: session.paidCentavos, currency: session.currency }, source, deps)
    return r.outcome === 'paid' || r.outcome === 'already_paid' ? 'paid' : 'not_pending'
  } catch (err) {
    console.error(`[${source}] reconcile failed`, { orderId, err })
    return 'error'
  }
}

export type CancelResult = { kind: 'cancelled' } | { kind: 'paid' } | { kind: 'not_pending' } | { kind: 'error'; reason: 'unreachable' | 'in_progress'; message: string }

/**
 * Cancels a pending order only after its PayMongo session is closed, so a customer can't pay a cancelled order.
 * If PayMongo says it was already paid, the payment is recorded instead and the order is not cancelled.
 */
export async function cancelPendingOrderCore(orderId: string, deps: PaymentOpsDeps, source = 'cancel'): Promise<CancelResult> {
  const order = await deps.getOrder(orderId)
  if (!order || order.status !== 'pending') return { kind: 'not_pending' }
  if (order.checkoutId && !otherMode(order, deps)) {
    let state: 'expired' | 'paid'
    try {
      state = await deps.expireSession(order.checkoutId)
    } catch (err) {
      console.error(`[${source}] could not expire the PayMongo session; not cancelling`, { orderId, err })
      return err instanceof SessionActiveError
        ? { kind: 'error', reason: 'in_progress', message: 'A payment may be in progress — wait a few minutes, then use Re-check payment.' }
        : { kind: 'error', reason: 'unreachable', message: "Couldn't reach PayMongo to close the payment page, so the order was not cancelled. Try again in a minute." }
    }
    if (state === 'paid') {
      const session = await deps.getSession(order.checkoutId).catch(() => null)
      await recordAndNotify(order.checkoutId, { paidCentavos: session?.paidCentavos ?? null, currency: session?.currency ?? null }, source, deps)
      return { kind: 'paid' }
    }
  }
  return (await deps.cancelOrder(orderId)) ? { kind: 'cancelled' } : { kind: 'not_pending' }
}

export type ExpireSummary = { checked: number; cancelled: number; paid: number; failed: number }

/** Cron: reconcile, then cancel, pending orders that were abandoned. */
export async function expireStalePendingCore(listStalePending: () => Promise<string[]>, deps: PaymentOpsDeps): Promise<ExpireSummary> {
  const ids = await listStalePending()
  const summary: ExpireSummary = { checked: ids.length, cancelled: 0, paid: 0, failed: 0 }
  for (const id of ids) {
    const rec = await reconcileOrderCore(id, deps, 'cron')
    if (rec === 'paid') { summary.paid++; continue }
    if (rec === 'error') { summary.failed++; continue }
    if (rec === 'not_pending' || rec === 'not_found') continue
    // 'pending', 'no_session' and 'other_mode' fall through to cancel.
    try {
      const r = await cancelPendingOrderCore(id, deps, 'cron')
      if (r.kind === 'cancelled') summary.cancelled++
      else if (r.kind === 'paid') summary.paid++
      else if (r.kind === 'error') summary.failed++
    } catch (err) {
      console.error('[cron] could not expire a pending order', { orderId: id, err })
      summary.failed++
    }
  }
  return summary
}
