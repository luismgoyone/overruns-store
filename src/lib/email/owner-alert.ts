import type { OwnerAlert } from '@/lib/orders/payments'
import { formatPeso } from '@/lib/money'
import { formatOrderNumber } from '@/lib/orders/format'
import type { OrderDetail } from '@/lib/orders/queries'
import { escapeHtml } from './order-confirmation'

const LABEL: Record<OwnerAlert, string> = { oversold: 'oversold', amount_mismatch: 'amount mismatch', paid_after_cancel: 'paid after cancel' }
const EXPLAIN: Record<OwnerAlert, string> = {
  oversold: 'This order was paid for more than the stock on hand. Check the shelf before shipping; refund the missing item in the PayMongo dashboard if it is not there. The customer was told we are double-checking stock and will hear from you within 24 hours.',
  amount_mismatch: 'The amount or currency PayMongo reported does not match the order total. Compare the payment in the PayMongo dashboard before shipping.',
  paid_after_cancel: 'PayMongo took a payment after this order was cancelled. Refund it in the PayMongo dashboard or fulfil the order from the admin page.',
}

export function renderOwnerAlert(order: OrderDetail, alerts: OwnerAlert[], siteUrl: string) {
  const number = formatOrderNumber(order.id)
  const url = `${siteUrl}/admin/orders/${order.id}`
  const lines = alerts.map((a) => EXPLAIN[a])
  const summary = `${order.customerName} · ${order.email} · ${order.phone} · ${formatPeso(order.totalCentavos)}`
  const text = [`Order ${number} needs a look.`, '', ...lines, '', summary, `Open the order: ${url}`].join('\n')
  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#111111">
<p style="font-weight:bold">Order ${number} needs a look.</p>
${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('\n')}
<p style="color:#6B6B6B">${escapeHtml(summary)}</p>
<p><a href="${url}">Open the order</a></p>
</body></html>`
  return { subject: `Action needed: order ${number} (${alerts.map((a) => LABEL[a]).join(', ')})`, text, html }
}
