import { describe, expect, it } from 'vitest'
import type { OrderDetail } from '@/lib/orders/queries'
import { renderOrderConfirmation } from './order-confirmation'

const order: OrderDetail = {
  id: '3f2a9c1e-1234-4abc-8def-0123456789ab', customerName: 'Juan <script>alert(1)</script>', email: 'juan@example.com', phone: '+639171234567',
  address: { street: '12 Mabini St', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '1210' },
  subtotalCentavos: 298000, shippingCentavos: 15000, totalCentavos: 313000, status: 'paid', oversold: false, createdAt: '2026-10-15T08:00:00Z',
  items: [{ productName: 'Coach Jacket', size: 'M', qty: 2, priceCentavos: 149000 }],
}

describe('renderOrderConfirmation', () => {
  it('includes order number, items, totals and a link to the order page', () => {
    const { subject, html, text } = renderOrderConfirmation(order, 'https://shop.test')
    expect(subject).toBe('Salamat! Order 3F2A9C1E is confirmed')
    expect(html).toContain('2 × Coach Jacket (M)')
    expect(html).toContain('₱3,130')
    expect(html).toContain('https://shop.test/order/3f2a9c1e-1234-4abc-8def-0123456789ab')
    expect(text).toContain('Total: ₱3,130')
  })
  it('escapes customer-provided text', () => {
    const { html } = renderOrderConfirmation(order, 'https://shop.test')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
