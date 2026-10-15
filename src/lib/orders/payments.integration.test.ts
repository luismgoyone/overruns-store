import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { afterAll, describe, expect, it } from 'vitest'
import { buildCheckoutDeps } from '@/lib/checkout/deps'
import { DuplicateOrderError } from '@/lib/checkout/start-checkout'
import type { Database } from '@/lib/supabase/database.types'
import { recordPayment } from './payment-ops-server'

const EMAIL = 'integration-payments@example.test'

describe.skipIf(process.env.SUPABASE_INTEGRATION !== '1')('payments against local Supabase', () => {
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const deps = buildCheckoutDeps('sk_test_unused')
  const customer = { name: 'Integration', email: EMAIL, phone: '+639171234567', street: '1 Test St', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '1210' }

  afterAll(async () => {
    await db.from('orders').delete().eq('email', EMAIL)
  })

  async function variant() {
    const { data, error } = await db.from('product_variants').select('id, size, stock, products!inner(name, price_centavos)').gt('stock', 0).limit(1).single()
    if (error) throw error
    return data
  }
  async function newOrder(key: string | null) {
    const v = await variant()
    const line = { variantId: v.id, productName: v.products.name, size: v.size, qty: 1, priceCentavos: v.products.price_centavos }
    return { v, id: await deps.createPendingOrder({ customer, lines: [line], subtotal: line.priceCentavos, shipping: 15000, total: line.priceCentavos + 15000, idempotencyKey: key }) }
  }

  it('creates order + items atomically and enforces the idempotency key', async () => {
    const key = randomUUID()
    const { id } = await newOrder(key)
    const { data: items } = await db.from('order_items').select('id').eq('order_id', id)
    expect(items).toHaveLength(1)
    await expect(newOrder(key)).rejects.toBeInstanceOf(DuplicateOrderError)
    await deps.attachCheckout(id, `cs_int${Date.now()}`, 'https://checkout.paymongo.com/cs_int')
    expect(await deps.findOrderByKey(key)).toEqual({ id, status: 'pending', checkoutUrl: 'https://checkout.paymongo.com/cs_int' })
  })

  it('flags a payment that lands after a cancel without touching stock', async () => {
    const { v, id } = await newOrder(null)
    const cs = `cs_intcancel${Date.now()}`
    await deps.attachCheckout(id, cs, 'https://checkout.paymongo.com/x')
    await deps.cancelOrder(id)
    const r = await recordPayment(cs, { paidCentavos: null, currency: 'PHP' })
    expect(r).toEqual({ orderId: id, outcome: 'paid_after_cancel', oversold: false, amountMismatch: false })
    const { data: order } = await db.from('orders').select('status, payment_conflict').eq('id', id).single()
    expect(order).toEqual({ status: 'cancelled', payment_conflict: true })
    const { data: after } = await db.from('product_variants').select('stock').eq('id', v.id).single()
    expect(after?.stock).toBe(v.stock)
  })

  it('reports unknown checkout ids', async () => {
    expect((await recordPayment('cs_doesnotexist', { paidCentavos: null, currency: null })).outcome).toBe('unknown')
  })
})
