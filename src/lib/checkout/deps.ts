import 'server-only'
import { SHIPPING_FEE_CENTAVOS, siteUrl } from '@/lib/config'
import { createCheckoutSession } from '@/lib/paymongo/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StartCheckoutDeps } from './start-checkout'

export function buildCheckoutDeps(secretKey: string): StartCheckoutDeps {
  const db = createAdminClient()
  return {
    async loadVariants(ids) {
      const { data, error } = await db.from('product_variants').select('id, size, stock, products!inner(id, name, is_active, price_centavos)').in('id', ids)
      if (error) throw error
      return data.map((v) => ({
        id: v.id, size: v.size, stock: v.stock,
        product: { id: v.products.id, name: v.products.name, isActive: v.products.is_active, priceCentavos: v.products.price_centavos },
      }))
    },
    async createPendingOrder({ customer, lines, subtotal, shipping, total }) {
      const { name, email, phone, street, barangay, city, province, zip } = customer
      const { data: order, error } = await db
        .from('orders')
        .insert({ customer_name: name, email, phone, address: { street, barangay, city, province, zip }, subtotal_centavos: subtotal, shipping_centavos: shipping, total_centavos: total })
        .select('id')
        .single()
      if (error) throw error
      const { error: itemsError } = await db.from('order_items').insert(
        lines.map((l) => ({ order_id: order.id, variant_id: l.variantId, product_name: l.productName, size: l.size, qty: l.qty, price_centavos: l.priceCentavos })),
      )
      if (itemsError) {
        await db.from('orders').delete().eq('id', order.id)
        throw itemsError
      }
      return order.id
    },
    async attachCheckout(orderId, checkoutId) {
      const { error } = await db.from('orders').update({ paymongo_checkout_id: checkoutId }).eq('id', orderId)
      if (error) throw error
    },
    async cancelOrder(orderId) {
      const { error } = await db.from('orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'pending')
      if (error) console.error('[checkout] could not cancel pending order', { orderId, error })
    },
    createSession: (input) => createCheckoutSession(input, { secretKey }),
    shippingFeeCentavos: SHIPPING_FEE_CENTAVOS,
    siteUrl: siteUrl(),
    paymentMethods: (process.env.PAYMONGO_PAYMENT_METHODS ?? 'card,gcash,paymaya,qrph').split(',').map((s) => s.trim()).filter(Boolean),
  }
}
