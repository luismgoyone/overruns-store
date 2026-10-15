import { sizeLabel } from '@/lib/catalog/constants'
import { formatPeso } from '@/lib/money'
import { formatOrderNumber } from '@/lib/orders/format'
import type { OrderDetail } from '@/lib/orders/queries'

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function renderOrderConfirmation(order: OrderDetail, siteUrl: string) {
  const number = formatOrderNumber(order.id)
  const url = `${siteUrl}/order/${order.id}`
  const itemLine = (i: OrderDetail['items'][number]) => `${i.qty} × ${i.productName} (${sizeLabel(i.size)})`
  const a = order.address
  const addressText = a ? `${a.street}, ${a.barangay}, ${a.city}, ${a.province} ${a.zip}` : ''

  const html = `<!doctype html><html><body style="margin:0;background:#F5F3EE;font-family:Inter,Arial,sans-serif;color:#111111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:1px solid #111111" cellpadding="24">
<tr><td>
<p style="margin:0 0 4px;font-weight:900;text-transform:uppercase;letter-spacing:.02em">The Overruns Project</p>
<h1 style="margin:0 0 16px;font-size:22px">Salamat, ${escapeHtml(order.customerName)}! Your order is confirmed.</h1>
<p style="margin:0 0 16px">Order <strong>${number}</strong></p>
<table role="presentation" width="100%" style="border-top:1px solid #111111;border-bottom:1px solid #111111" cellpadding="6">
${order.items.map((i) => `<tr><td>${escapeHtml(itemLine(i))}</td><td align="right">${formatPeso(i.qty * i.priceCentavos)}</td></tr>`).join('')}
<tr><td style="color:#6B6B6B">Shipping</td><td align="right" style="color:#6B6B6B">${formatPeso(order.shippingCentavos)}</td></tr>
<tr><td><strong>Total</strong></td><td align="right"><strong>${formatPeso(order.totalCentavos)}</strong></td></tr>
</table>
${addressText ? `<p style="margin:16px 0 4px;font-weight:bold">Delivering to</p>
<p style="margin:0 0 16px;color:#6B6B6B">${escapeHtml(addressText)}</p>` : ''}
<p style="margin:0"><a href="${url}" style="display:inline-block;background:#E85D2A;color:#111111;border:1px solid #111111;padding:12px 20px;font-weight:bold;text-decoration:none;text-transform:uppercase">View your order</a></p>
</td></tr></table></td></tr></table></body></html>`

  const text = [
    `Salamat, ${order.customerName}! Your order ${number} is confirmed.`,
    '',
    ...order.items.map((i) => `${itemLine(i)}  ${formatPeso(i.qty * i.priceCentavos)}`),
    `Shipping: ${formatPeso(order.shippingCentavos)}`,
    `Total: ${formatPeso(order.totalCentavos)}`,
    '',
    ...(addressText ? [`Delivering to: ${addressText}`] : []),
    `View your order: ${url}`,
  ].join('\n')

  return { subject: `Salamat! Order ${number} is confirmed`, html, text }
}
