import 'server-only'
import { SHIPPING_FEE_CENTAVOS, siteUrl } from '@/lib/config'
import { createCheckoutSession, expireSession } from '@/lib/paymongo/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { DuplicateOrderError, type StartCheckoutDeps } from './start-checkout'

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
    async findOrderByKey(key) {
      const { data, error } = await db.from('orders').select('id, status, paymongo_checkout_url').eq('idempotency_key', key).maybeSingle()
      if (error) throw error
      return data ? { id: data.id, status: data.status, checkoutUrl: data.paymongo_checkout_url } : null
    },
    async createPendingOrder({ customer, lines, subtotal, shipping, total, idempotencyKey }) {
      const { name, email, phone, street, barangay, city, province, zip } = customer
      // One transaction: the order and its items land together or not at all.
      const { data, error } = await db.rpc('create_pending_order', {
        p_order: {
          customer_name: name, email, phone, address: { street, barangay, city, province, zip },
          subtotal_centavos: subtotal, shipping_centavos: shipping, total_centavos: total, idempotency_key: idempotencyKey,
          items: lines.map((l) => ({ variant_id: l.variantId, product_name: l.productName, size: l.size, qty: l.qty, price_centavos: l.priceCentavos })),
        },
      })
      if (error) {
        if (error.code === '23505' && idempotencyKey) throw new DuplicateOrderError()
        throw error
      }
      return data
    },
    async attachCheckout(orderId, checkoutId, checkoutUrl) {
      const { error } = await db.from('orders').update({ paymongo_checkout_id: checkoutId, paymongo_checkout_url: checkoutUrl }).eq('id', orderId)
      if (error) throw error
    },
    async cancelOrder(orderId) {
      const { error } = await db.from('orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'pending')
      if (error) console.error('[checkout] could not cancel pending order', { orderId, error })
    },
    createSession: (input) => createCheckoutSession(input, { secretKey }),
    expireSession: (checkoutId) => expireSession(checkoutId, { secretKey }),
    shippingFeeCentavos: SHIPPING_FEE_CENTAVOS,
    siteUrl: siteUrl(),
    paymentMethods: (process.env.PAYMONGO_PAYMENT_METHODS ?? 'card,gcash,paymaya,qrph').split(',').map((s) => s.trim()).filter(Boolean),
  }
}
