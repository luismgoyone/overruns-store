import type { PricedLine } from '@/lib/checkout/types'
import { formatOrderNumber } from '@/lib/orders/format'

const API_BASE = 'https://api.paymongo.com/v1'

export class PayMongoError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message)
    this.name = 'PayMongoError'
  }
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
  { secretKey, fetchImpl = fetch }: { secretKey: string; fetchImpl?: typeof fetch },
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
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
    },
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
