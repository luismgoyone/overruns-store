import { afterPayment, type AfterPaymentDeps, type PaymentInfo, type PaymentRecord } from '@/lib/orders/payments'
import { parseCheckoutSession } from './client'
import { matchPaymongoSignature } from './signature'

export const MAX_WEBHOOK_BYTES = 256 * 1024

export type WebhookDeps = AfterPaymentDeps & {
  secret: string
  /** true for a live secret key, false for a test key, null when unknown (then any mode is accepted). */
  expectedLivemode: boolean | null
  /** Records the payment (idempotent). Throws on database errors so PayMongo retries. */
  recordPayment(checkoutId: string, info: PaymentInfo): Promise<PaymentRecord>
  nowMs(): number
}
type Result = { status: number; body: Record<string, unknown> }

type PaymongoEvent = { data?: { attributes?: { type?: string; livemode?: boolean; data?: { id?: unknown } } } }

const isCheckoutId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200

export async function handlePaymongoWebhook(req: { rawBody: string; signatureHeader: string | null }, deps: WebhookDeps): Promise<Result> {
  if (!deps.secret) return { status: 500, body: { error: 'webhook secret not configured' } }
  if (Buffer.byteLength(req.rawBody, 'utf8') > MAX_WEBHOOK_BYTES) return { status: 413, body: { error: 'payload too large' } }

  // Verify before parsing so unauthenticated bodies are never deserialized.
  const signedAs = matchPaymongoSignature({ header: req.signatureHeader, rawBody: req.rawBody, secret: deps.secret, nowMs: deps.nowMs() })
  if (!signedAs) return { status: 401, body: { error: 'invalid signature' } }

  let event: PaymongoEvent
  try {
    event = JSON.parse(req.rawBody)
  } catch {
    return { status: 400, body: { error: 'invalid JSON' } }
  }
  if (typeof event !== 'object' || event === null) return { status: 400, body: { error: 'invalid event' } }
  const attrs = event.data?.attributes
  const livemode = attrs?.livemode === true
  // livemode picks which signature (te/li) PayMongo used; both are keyed by our secret.
  if ((signedAs === 'li') !== livemode) return { status: 401, body: { error: 'invalid signature' } }

  if (attrs?.type !== 'checkout_session.payment.paid') return { status: 200, body: { ignored: attrs?.type ?? 'unknown' } }
  if (deps.expectedLivemode !== null && livemode !== deps.expectedLivemode) {
    console.error('[webhook] event mode does not match the PayMongo key mode; ignoring', { livemode, expectedLivemode: deps.expectedLivemode })
    return { status: 200, body: { ignored: 'livemode mismatch' } }
  }
  const checkoutId = attrs.data?.id
  if (!isCheckoutId(checkoutId)) return { status: 400, body: { error: 'missing or invalid checkout session id' } }

  const session = parseCheckoutSession(attrs.data)
  const r = await deps.recordPayment(checkoutId, { paidCentavos: session.paidCentavos, currency: session.currency }) // throws → 500 → PayMongo retries
  await afterPayment(r, { checkoutId, source: 'webhook' }, deps)

  switch (r.outcome) {
    case 'paid': return { status: 200, body: { ok: true, orderId: r.orderId } }
    case 'already_paid': return { status: 200, body: { ignored: 'already paid', orderId: r.orderId } }
    // 200 so PayMongo doesn't retry forever; the order is flagged for the owner.
    case 'paid_after_cancel': return { status: 200, body: { conflict: 'paid_after_cancel', orderId: r.orderId } }
    default: return { status: 200, body: { ignored: 'unknown checkout session' } }
  }
}
