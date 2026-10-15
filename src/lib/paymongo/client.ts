import type { PricedLine } from '@/lib/checkout/types'
import { formatOrderNumber } from '@/lib/orders/format'

const API_BASE = 'https://api.paymongo.com/v1'

export class PayMongoError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message)
    this.name = 'PayMongoError'
  }
}

type Auth = { secretKey: string; fetchImpl?: typeof fetch }

const authHeaders = (secretKey: string) => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
})

export const CHECKOUT_ID = /^cs_[A-Za-z0-9]{1,190}$/

export type CheckoutSessionInfo = {
  id: string
  status: string | null
  paid: boolean
  paidCentavos: number | null
  currency: string | null
  livemode: boolean | null
}

type Resource = { id?: unknown; attributes?: Record<string, unknown> | null } | null | undefined
const attrsOf = (r: unknown) => ((r as Resource)?.attributes ?? {}) as Record<string, unknown>

// Accepts a checkout_session resource, from GET /checkout_sessions/{id} or a webhook event's data.
export function parseCheckoutSession(resource: unknown): CheckoutSessionInfo {
  const a = attrsOf(resource)
  const payments = Array.isArray(a.payments) ? a.payments.map(attrsOf) : []
  const paidPayments = payments.filter((p) => p.status === 'paid')
  const intent = attrsOf(a.payment_intent)
  const paid = paidPayments.length > 0 || intent.status === 'succeeded'
  const amounts = paidPayments.map((p) => p.amount).filter((n): n is number => typeof n === 'number')
  const currency = paidPayments.map((p) => p.currency).find((c): c is string => typeof c === 'string') ?? null
  return {
    id: String((resource as Resource)?.id ?? ''),
    status: typeof a.status === 'string' ? a.status : null,
    paid,
    paidCentavos: amounts.length > 0 ? amounts.reduce((x, y) => x + y, 0) : null,
    currency,
    livemode: typeof a.livemode === 'boolean' ? a.livemode : null,
  }
}

function assertCheckoutId(id: string) {
  if (!CHECKOUT_ID.test(id)) throw new PayMongoError('Not a PayMongo checkout session id', 0, null)
}

export async function getCheckoutSession(id: string, { secretKey, fetchImpl = fetch }: Auth): Promise<CheckoutSessionInfo> {
  assertCheckoutId(id)
  const res = await fetchImpl(`${API_BASE}/checkout_sessions/${id}`, { method: 'GET', signal: AbortSignal.timeout(8_000), headers: authHeaders(secretKey) })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new PayMongoError(`PayMongo get checkout session failed (${res.status})`, res.status, body)
  return parseCheckoutSession(body?.data)
}

/**
 * Closes a checkout session so it can't be paid any more. Resolves 'expired' when the session is closed
 * (now or before) and 'paid' when it was already paid; throws when its state is unknown or it's still open.
 */
export async function expireSession(id: string, auth: Auth): Promise<'expired' | 'paid'> {
  assertCheckoutId(id)
  const { secretKey, fetchImpl = fetch } = auth
  const res = await fetchImpl(`${API_BASE}/checkout_sessions/${id}/expire`, { method: 'POST', signal: AbortSignal.timeout(8_000), headers: authHeaders(secretKey) })
  const body = await res.json().catch(() => null)
  if (res.ok) {
    const s = parseCheckoutSession(body?.data)
    return s.paid ? 'paid' : 'expired'
  }
  // PayMongo refuses to expire a paid or already-expired session; look at it to tell which.
  const s = await getCheckoutSession(id, auth)
  if (s.paid) return 'paid'
  if (s.status === 'expired') return 'expired'
  throw new PayMongoError(`PayMongo expire checkout session failed (${res.status})`, res.status, body)
}

export type CheckoutSessionInput = {
  orderId: string
  lines: PricedLine[]
  shippingCentavos: number
  customer: { name: string; email: string; phone: string }
  successUrl: string
  cancelUrl: string
  paymentMethods: string[]
}

export async function createCheckoutSession(
  input: CheckoutSessionInput,
  { secretKey, fetchImpl = fetch }: Auth,
): Promise<{ id: string; checkoutUrl: string }> {
  const lineItems = input.lines.map((l) => ({
    currency: 'PHP',
    amount: l.priceCentavos,
    name: l.size === 'OS' ? l.productName : `${l.productName} (${l.size})`,
    quantity: l.qty,
  }))
  if (input.shippingCentavos > 0) lineItems.push({ currency: 'PHP', amount: input.shippingCentavos, name: 'Shipping (flat rate)', quantity: 1 })

  const res = await fetchImpl(`${API_BASE}/checkout_sessions`, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: authHeaders(secretKey),
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: lineItems,
          payment_method_types: input.paymentMethods,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          reference_number: input.orderId,
          description: `The Overruns Project order ${formatOrderNumber(input.orderId)}`,
          billing: input.customer,
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          metadata: { order_id: input.orderId },
        },
      },
    }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new PayMongoError(`PayMongo checkout session failed (${res.status})`, res.status, body)
  return { id: body.data.id, checkoutUrl: body.data.attributes.checkout_url }
}
