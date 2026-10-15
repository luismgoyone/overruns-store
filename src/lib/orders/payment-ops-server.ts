import 'server-only'
import { notifyOwner } from '@/lib/email/notify-owner'
import { sendConfirmationIfUnsent } from '@/lib/email/send-order-confirmation'
import { expireSession, getCheckoutSession } from '@/lib/paymongo/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPaymentOutcome, type PaymentInfo, type PaymentRecord } from './payments'
import { cancelPendingOrderCore, reconcileOrderCore, type CancelResult, type PaymentOpsDeps, type ReconcileResult } from './payment-ops'

export const paymongoSecretKey = () => process.env.PAYMONGO_SECRET_KEY?.trim() || null

/** true for a live key, false for a test key, null when it can't be told. */
export function expectedLivemode(secretKey: string | null): boolean | null {
  if (secretKey?.startsWith('sk_live_')) return true
  if (secretKey?.startsWith('sk_test_')) return false
  return null
}

function requireKey(): string {
  const key = paymongoSecretKey()
  if (!key) throw new Error('PAYMONGO_SECRET_KEY is not set')
  return key
}

/** Same database path as the webhook. Throws on database errors. */
export async function recordPayment(checkoutId: string, info: PaymentInfo): Promise<PaymentRecord> {
  const { data, error } = await createAdminClient().rpc('record_checkout_payment', {
    p_checkout_id: checkoutId,
    p_paid_centavos: info.paidCentavos ?? undefined,
    p_currency: info.currency ?? undefined,
  })
  if (error) throw error
  const row = data?.[0]
  if (!row || !isPaymentOutcome(row.outcome)) throw new Error(`record_checkout_payment returned ${JSON.stringify(data)}`)
  return { orderId: row.order_id, outcome: row.outcome, oversold: row.oversold, amountMismatch: row.amount_mismatch }
}

/**
 * Server dependencies for reconciliation and safe cancels. `onStockChange` runs after an order turns paid
 * (route handlers and server actions pass revalidatePath; render paths can't revalidate and rely on ISR).
 */
type OpsOptions = {
  onStockChange?: () => void
  /** Run emails later (e.g. next/server `after` on a page render) instead of awaiting them. */
  defer?: (fn: () => Promise<void>) => void
}

export function buildPaymentOps({ onStockChange, defer }: OpsOptions = {}): PaymentOpsDeps {
  const db = createAdminClient()
  const later = <A extends unknown[]>(label: string, fn: (...args: A) => Promise<void>) =>
    defer
      ? async (...args: A) => defer(() => fn(...args).catch((err) => console.error(`[payments] deferred ${label} failed`, { args, err })))
      : fn
  return {
    async getOrder(orderId) {
      const { data, error } = await db.from('orders').select('id, status, paymongo_checkout_id, created_at').eq('id', orderId).maybeSingle()
      if (error) throw error
      return data ? { id: data.id, status: data.status, checkoutId: data.paymongo_checkout_id, createdAt: data.created_at } : null
    },
    getSession: (checkoutId) => getCheckoutSession(checkoutId, { secretKey: requireKey() }),
    expireSession: (checkoutId) => expireSession(checkoutId, { secretKey: requireKey() }),
    async recordPayment(checkoutId, info) {
      const r = await recordPayment(checkoutId, info)
      if (r.outcome === 'paid') onStockChange?.()
      return r
    },
    async cancelOrder(orderId) {
      const { data, error } = await db.from('orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'pending').select('id')
      if (error) throw error
      return data.length > 0
    },
    sendConfirmation: later('confirmation email', sendConfirmationIfUnsent),
    notifyOwner: later('owner alert', notifyOwner),
  }
}

/** Reconcile one pending order with PayMongo. Skipped (never throws) when PayMongo isn't configured. */
export async function reconcileOrder(orderId: string, opts: OpsOptions = {}): Promise<ReconcileResult | 'skipped'> {
  if (!paymongoSecretKey()) return 'skipped'
  try {
    return await reconcileOrderCore(orderId, buildPaymentOps(opts))
  } catch (err) {
    console.error('[reconcile] failed', { orderId, err })
    return 'error'
  }
}

export async function cancelPendingOrder(orderId: string, opts: OpsOptions = {}): Promise<CancelResult> {
  return cancelPendingOrderCore(orderId, buildPaymentOps(opts))
}
