import type { CheckoutSessionInput } from '@/lib/paymongo/client'
import type { OrderStatus } from '@/lib/catalog/constants'
import { priceCart } from './price-cart'
import type { CartPayloadLine, CheckoutForm } from './schema'
import type { CartProblem, DbVariant, PricedLine } from './types'

export type NewOrder = { customer: CheckoutForm; lines: PricedLine[]; subtotal: number; shipping: number; total: number; idempotencyKey: string | null }
export type ExistingOrder = { id: string; status: OrderStatus; checkoutUrl: string | null }

/** Thrown by createPendingOrder when an order with the same idempotency key already exists. */
export class DuplicateOrderError extends Error {
  constructor() {
    super('An order with this idempotency key already exists')
    this.name = 'DuplicateOrderError'
  }
}

export type StartCheckoutDeps = {
  loadVariants(ids: string[]): Promise<DbVariant[]>
  findOrderByKey(idempotencyKey: string): Promise<ExistingOrder | null>
  createPendingOrder(order: NewOrder): Promise<string>
  attachCheckout(orderId: string, checkoutId: string, checkoutUrl: string): Promise<void>
  cancelOrder(orderId: string): Promise<void>
  createSession(input: CheckoutSessionInput): Promise<{ id: string; checkoutUrl: string }>
  expireSession(checkoutId: string): Promise<unknown>
  shippingFeeCentavos: number
  siteUrl: string
  paymentMethods: string[]
}

export type StartCheckoutResult =
  | { kind: 'redirect'; url: string }
  | { kind: 'cart_problems'; problems: CartProblem[] }
  | { kind: 'error'; message: string }

const ALREADY_PROCESSING = "We're already processing this order. Please wait a few seconds and try again."

function resume(order: ExistingOrder, siteUrl: string): StartCheckoutResult {
  if (order.status === 'pending' && order.checkoutUrl) return { kind: 'redirect', url: order.checkoutUrl }
  if (order.status === 'paid' || order.status === 'shipped') return { kind: 'redirect', url: `${siteUrl}/order/${order.id}` }
  if (order.status === 'pending') return { kind: 'error', message: ALREADY_PROCESSING }
  return { kind: 'error', message: 'That checkout attempt was closed. Please try again.' }
}

export async function startCheckoutCore(form: CheckoutForm, cart: CartPayloadLine[], deps: StartCheckoutDeps, idempotencyKey: string | null = null): Promise<StartCheckoutResult> {
  let orderId: string
  let priced: Extract<ReturnType<typeof priceCart>, { ok: true }>
  try {
    if (idempotencyKey) {
      const existing = await deps.findOrderByKey(idempotencyKey)
      if (existing) return resume(existing, deps.siteUrl)
    }
    const variants = await deps.loadVariants([...new Set(cart.map((l) => l.variantId))])
    const result = priceCart(cart, variants, deps.shippingFeeCentavos)
    if (!result.ok) return { kind: 'cart_problems', problems: result.problems }
    priced = result
    try {
      orderId = await deps.createPendingOrder({ customer: form, lines: priced.lines, subtotal: priced.subtotal, shipping: priced.shipping, total: priced.total, idempotencyKey })
    } catch (err) {
      if (!(err instanceof DuplicateOrderError) || !idempotencyKey) throw err
      // A concurrent submit with the same key won the insert.
      const existing = await deps.findOrderByKey(idempotencyKey)
      return existing ? resume(existing, deps.siteUrl) : { kind: 'error', message: ALREADY_PROCESSING }
    }
  } catch (err) {
    console.error('[checkout] could not prepare order', err)
    return { kind: 'error', message: 'Something went wrong preparing your order. Please try again.' }
  }
  let session: { id: string; checkoutUrl: string } | null = null
  try {
    session = await deps.createSession({
      orderId,
      lines: priced.lines,
      shippingCentavos: priced.shipping,
      customer: { name: form.name, email: form.email, phone: form.phone },
      successUrl: `${deps.siteUrl}/order/${orderId}`,
      cancelUrl: `${deps.siteUrl}/cart?cancelled=1`,
      paymentMethods: deps.paymentMethods,
    })
    await deps.attachCheckout(orderId, session.id, session.checkoutUrl)
    return { kind: 'redirect', url: session.checkoutUrl }
  } catch (err) {
    console.error('[checkout] PayMongo session failed', err)
    if (session) {
      // The session exists but isn't linked to the order: close it so nobody can pay it.
      try {
        await deps.expireSession(session.id)
      } catch (expireErr) {
        console.error('[checkout] could not expire an unattached PayMongo session; watch for an unknown-checkout payment', { orderId, checkoutId: session.id, expireErr })
      }
    }
    await deps.cancelOrder(orderId)
    return { kind: 'error', message: "We couldn't open the payment page. Please try again in a minute." }
  }
}
