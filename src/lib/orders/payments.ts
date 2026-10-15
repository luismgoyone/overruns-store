// What happened when a PayMongo payment was recorded against an order (see record_checkout_payment in SQL).
export type PaymentOutcome = 'paid' | 'already_paid' | 'paid_after_cancel' | 'unknown'
export type PaymentRecord = {
  orderId: string | null
  outcome: PaymentOutcome
  oversold: boolean
  amountMismatch: boolean
  /** paid_after_cancel only: true on the call that first flagged it (alert the owner once). */
  newConflict: boolean
}
export type PaymentInfo = { paidCentavos: number | null; currency: string | null }
export type OwnerAlert = 'oversold' | 'amount_mismatch' | 'paid_after_cancel'

export type AfterPaymentDeps = {
  /** Sends the customer confirmation at most once per order (claimed in the database). */
  sendConfirmation(orderId: string): Promise<void>
  /** Emails the owner; a no-op when OWNER_NOTIFY_EMAIL isn't set. */
  notifyOwner(orderId: string, alerts: OwnerAlert[]): Promise<void>
}

const OUTCOMES: readonly PaymentOutcome[] = ['paid', 'already_paid', 'paid_after_cancel', 'unknown']
export const isPaymentOutcome = (s: unknown): s is PaymentOutcome => OUTCOMES.includes(s as PaymentOutcome)

async function quietly(label: string, ctx: Record<string, unknown>, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (err) {
    console.error(`[payments] ${label} failed`, { ...ctx, err })
  }
}

/** Emails and alerts after a payment was recorded. Never throws: the payment itself is already saved. */
export async function afterPayment(r: PaymentRecord, ctx: { checkoutId: string; source: string }, deps: AfterPaymentDeps): Promise<void> {
  const log = { ...ctx, orderId: r.orderId }
  if (r.outcome === 'unknown' || !r.orderId) {
    console.error(`[${ctx.source}] payment for an unknown checkout session`, log)
    return
  }
  const orderId = r.orderId
  if (r.outcome === 'paid_after_cancel') {
    console.error(`[${ctx.source}] PAID AFTER CANCEL: money arrived for a cancelled order. Refund it in PayMongo or fulfil it.`, log)
    if (r.newConflict) await quietly('owner alert', log, () => deps.notifyOwner(orderId, ['paid_after_cancel']))
    return
  }
  if (r.outcome === 'already_paid') console.info(`[${ctx.source}] order already paid`, log)
  if (r.amountMismatch) console.error(`[${ctx.source}] paid amount or currency does not match the order total`, log)

  await quietly('confirmation email', log, () => deps.sendConfirmation(orderId))
  if (r.outcome !== 'paid') return
  const alerts: OwnerAlert[] = []
  if (r.oversold) alerts.push('oversold')
  if (r.amountMismatch) alerts.push('amount_mismatch')
  if (alerts.length > 0) await quietly('owner alert', log, () => deps.notifyOwner(orderId, alerts))
}
