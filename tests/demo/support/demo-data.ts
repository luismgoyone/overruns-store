// Demo rows for the recording, added to the local Supabase stack and removed again afterwards.
//
// Everything added is tagged: orders use `demo+…@example.com` emails and the admin is
// `demo-admin@example.com`. The only existing row the run touches is the stock of the
// size the shopper buys (the real webhook takes it); teardown puts that stock back.
import { createClient } from '@supabase/supabase-js'
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_EMAIL_PATTERN, DEMO_SHOPPER_EMAIL, localSupabase } from './env'

const SHIPPING = 15000
const HOUR = 3_600_000

// Earlier orders so the admin list doesn't look empty. Names and addresses are made up.
const PAST_ORDERS = [
  { name: 'Miguel Reyes', slug: 'coach-jacket-black', size: 'M', hoursAgo: 5, status: 'paid' },
  { name: 'Bea Navarro', slug: 'slim-chino-khaki', size: 'S', hoursAgo: 26, status: 'shipped' },
  { name: 'Carlo Lim', slug: 'canvas-tote-natural', size: 'OS', hoursAgo: 49, status: 'shipped' },
  { name: 'Jessa Cruz', slug: 'striped-polo-navy', size: 'M', hoursAgo: 74, status: 'shipped' },
] as const

function db() {
  const { url, serviceRoleKey } = localSupabase()
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

function check(res: { error: unknown }, what: string) {
  if (res.error) throw new Error(`demo: ${what} failed: ${JSON.stringify(res.error)}`)
}

function must<R extends { data: unknown; error: unknown }>(res: R, what: string): NonNullable<R['data']> {
  if (res.error || res.data == null) throw new Error(`demo: ${what} failed: ${JSON.stringify(res.error)}`)
  return res.data as NonNullable<R['data']>
}

export async function seedDemoData() {
  await cleanUpDemoData()
  const s = db()

  const { user } = must(
    await s.auth.admin.createUser({ email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD, email_confirm: true }),
    'create demo admin',
  )
  check(await s.from('admins').insert({ user_id: user!.id }), 'grant demo admin')

  for (const [i, o] of PAST_ORDERS.entries()) {
    const product = must(
      await s.from('products').select('name, price_centavos, product_variants!inner(id, size)').eq('slug', o.slug).eq('product_variants.size', o.size).single(),
      `look up ${o.slug}`,
    )
    const createdAt = new Date(Date.now() - o.hoursAgo * HOUR).toISOString()
    const order = must(
      await s
        .from('orders')
        .insert({
          customer_name: o.name,
          email: `demo+order${i + 1}@example.com`,
          phone: '0917 555 0100',
          address: { street: '1 Demo St.', barangay: 'Demo', city: 'Quezon City', province: 'Metro Manila', zip: '1100' },
          subtotal_centavos: product.price_centavos,
          shipping_centavos: SHIPPING,
          total_centavos: product.price_centavos + SHIPPING,
          status: o.status,
          paid_at: createdAt,
          created_at: createdAt,
        })
        .select('id')
        .single(),
      'insert demo order',
    )
    check(
      await s.from('order_items').insert({
        order_id: order.id, variant_id: product.product_variants[0].id, product_name: product.name, size: o.size, qty: 1, price_centavos: product.price_centavos,
      }),
      'insert demo order item',
    )
  }
}

export async function cleanUpDemoData() {
  const s = db()

  // Give back the stock the shopper's paid order took.
  const paid = must(
    await s.from('orders').select('id, order_items(variant_id, qty)').eq('email', DEMO_SHOPPER_EMAIL).in('status', ['paid', 'shipped']),
    'find paid demo orders',
  )
  for (const item of paid.flatMap((o) => o.order_items)) {
    if (!item.variant_id) continue
    const { stock } = must(await s.from('product_variants').select('stock').eq('id', item.variant_id).single(), 'read stock')
    check(await s.from('product_variants').update({ stock: stock + item.qty }).eq('id', item.variant_id), 'restore stock')
  }

  // order_items go with their orders (on delete cascade).
  check(await s.from('orders').delete().like('email', DEMO_EMAIL_PATTERN), 'delete demo orders')

  const { users } = must(await s.auth.admin.listUsers({ perPage: 1000 }), 'list users')
  for (const u of users.filter((u) => u.email === DEMO_ADMIN_EMAIL)) {
    check(await s.from('admins').delete().eq('user_id', u.id), 'revoke demo admin')
    check(await s.auth.admin.deleteUser(u.id), 'delete demo admin')
  }
}
