import { describe, expect, it } from 'vitest'
import type { OrderDetail } from '@/lib/orders/queries'
import { renderOwnerAlert } from './owner-alert'

const order = {
  id: '3f2a9c1e-1234-4abc-8def-0123456789ab', customerName: 'Juan <b>', email: 'juan@example.com', phone: '+639171234567', address: null,
  subtotalCentavos: 298000, shippingCentavos: 15000, totalCentavos: 313000, status: 'paid', oversold: true, paymentConflict: false, amountMismatch: false,
  confirmationSentAt: null, paidAt: null, idempotencyKey: null, createdAt: '2026-10-15T08:00:00Z',
  items: [{ productName: 'Coach Jacket', size: 'M', qty: 2, priceCentavos: 149000 }],
} satisfies OrderDetail

describe('renderOwnerAlert', () => {
  it('explains each alert and links to the admin order page', () => {
    const { subject, text, html } = renderOwnerAlert(order, ['oversold', 'amount_mismatch'], 'https://shop.test')
    expect(subject).toBe('Action needed: order 3F2A9C1E (oversold, amount mismatch)')
    expect(text).toContain('more than the stock')
    expect(text).toContain('does not match')
    expect(text).toContain('https://shop.test/admin/orders/3f2a9c1e-1234-4abc-8def-0123456789ab')
    expect(html).toContain('Juan &lt;b&gt;')
  })
  it('describes a payment that landed after a cancel', () => {
    const { subject, text } = renderOwnerAlert({ ...order, status: 'cancelled', paymentConflict: true }, ['paid_after_cancel'], 'https://shop.test')
    expect(subject).toContain('paid after cancel')
    expect(text).toMatch(/refund it in the PayMongo dashboard or fulfil/i)
  })
})
