import type { CheckoutSessionInput } from '@/lib/paymongo/client'
import { priceCart } from './price-cart'
import type { CartPayloadLine, CheckoutForm } from './schema'
import type { CartProblem, DbVariant, PricedLine } from './types'

export type NewOrder = { customer: CheckoutForm; lines: PricedLine[]; subtotal: number; shipping: number; total: number }

export type StartCheckoutDeps = {
  loadVariants(ids: string[]): Promise<DbVariant[]>
  createPendingOrder(order: NewOrder): Promise<string>
  attachCheckout(orderId: string, checkoutId: string): Promise<void>
  cancelOrder(orderId: string): Promise<void>
  createSession(input: CheckoutSessionInput): Promise<{ id: string; checkoutUrl: string }>
  shippingFeeCentavos: number
  siteUrl: string
  paymentMethods: string[]
}

export type StartCheckoutResult =
  | { kind: 'redirect'; url: string }
  | { kind: 'cart_problems'; problems: CartProblem[] }
  | { kind: 'error'; message: string }

export async function startCheckoutCore(form: CheckoutForm, cart: CartPayloadLine[], deps: StartCheckoutDeps): Promise<StartCheckoutResult> {
  const variants = await deps.loadVariants([...new Set(cart.map((l) => l.variantId))])
  const priced = priceCart(cart, variants, deps.shippingFeeCentavos)
  if (!priced.ok) return { kind: 'cart_problems', problems: priced.problems }

  const orderId = await deps.createPendingOrder({ customer: form, lines: priced.lines, subtotal: priced.subtotal, shipping: priced.shipping, total: priced.total })
  try {
    const session = await deps.createSession({
      orderId,
      lines: priced.lines,
      shippingCentavos: priced.shipping,
      customer: { name: form.name, email: form.email, phone: form.phone },
      successUrl: `${deps.siteUrl}/order/${orderId}`,
      cancelUrl: `${deps.siteUrl}/cart?cancelled=1`,
      paymentMethods: deps.paymentMethods,
    })
    await deps.attachCheckout(orderId, session.id)
    return { kind: 'redirect', url: session.checkoutUrl }
  } catch (err) {
    console.error('[checkout] PayMongo session failed', err)
    await deps.cancelOrder(orderId)
    return { kind: 'error', message: "We couldn't open the payment page. Please try again in a minute." }
  }
}
