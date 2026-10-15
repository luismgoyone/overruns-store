import { verifyPaymongoSignature } from './signature'

export type WebhookDeps = {
  secret: string
  markPaid(checkoutId: string): Promise<string | null>
  sendConfirmation(orderId: string): Promise<void>
  nowMs(): number
}
type Result = { status: number; body: Record<string, unknown> }

type PaymongoEvent = { data?: { attributes?: { type?: string; livemode?: boolean; data?: { id?: string } } } }

export async function handlePaymongoWebhook(req: { rawBody: string; signatureHeader: string | null }, deps: WebhookDeps): Promise<Result> {
  if (!deps.secret) return { status: 500, body: { error: 'webhook secret not configured' } }

  let event: PaymongoEvent
  try {
    event = JSON.parse(req.rawBody)
  } catch {
    return { status: 400, body: { error: 'invalid JSON' } }
  }
  if (typeof event !== 'object' || event === null) return { status: 400, body: { error: 'invalid event' } }
  const attrs = event.data?.attributes
  // livemode only selects which signature (te/li) to check; both are keyed by our secret.
  const signed = verifyPaymongoSignature({ header: req.signatureHeader, rawBody: req.rawBody, secret: deps.secret, livemode: attrs?.livemode === true, nowMs: deps.nowMs() })
  if (!signed) return { status: 401, body: { error: 'invalid signature' } }

  if (attrs?.type !== 'checkout_session.payment.paid') return { status: 200, body: { ignored: attrs?.type ?? 'unknown' } }
  const checkoutId = attrs.data?.id
  if (!checkoutId) return { status: 400, body: { error: 'missing checkout session id' } }

  const orderId = await deps.markPaid(checkoutId) // throws → 500 → PayMongo retries
  if (!orderId) return { status: 200, body: { ignored: 'already processed or unknown checkout session' } }

  try {
    await deps.sendConfirmation(orderId)
  } catch (err) {
    console.error('[webhook] confirmation email failed', { orderId, err })
  }
  return { status: 200, body: { ok: true, orderId } }
}
