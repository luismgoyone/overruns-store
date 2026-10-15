import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClearCartOnMount } from '@/components/cart/clear-cart-on-mount'
import { PendingRefresher } from '@/components/order/pending-refresher'
import { buttonPrimary } from '@/components/ui/styles'
import { sizeLabel } from '@/lib/catalog/constants'
import { formatPeso } from '@/lib/money'
import { formatOrderNumber } from '@/lib/orders/format'
import { getOrderDetail } from '@/lib/orders/queries'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your order', robots: { index: false } }

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const order = await getOrderDetail(createAdminClient(), (await params).id)
  if (!order) notFound()
  const a = order.address
  const paidOrLater = order.status === 'paid' || order.status === 'shipped'

  return (
    <div className="max-w-xl space-y-6 px-4 py-8">
      <ClearCartOnMount />
      {paidOrLater ? (
        <div className="space-y-2">
          <div aria-hidden className="flex h-14 w-14 items-center justify-center border border-ink bg-tag text-3xl">✓</div>
          <h1 className="font-display text-2xl">Salamat! Your order is confirmed</h1>
        </div>
      ) : order.status === 'cancelled' ? (
        <h1 className="font-display text-2xl">This order was cancelled</h1>
      ) : (
        <div className="space-y-2">
          <h1 className="font-display text-2xl">Almost there</h1>
          <PendingRefresher />
        </div>
      )}
      <p>Order <strong>{formatOrderNumber(order.id)}</strong>{order.status === 'shipped' ? ' · Shipped' : ''}</p>
      <ul className="divide-y divide-ink border-y border-ink">
        {order.items.map((i, idx) => (
          <li key={idx} className="flex justify-between py-2 text-sm"><span>{i.qty} × {i.productName} ({sizeLabel(i.size)})</span><span>{formatPeso(i.qty * i.priceCentavos)}</span></li>
        ))}
        <li className="flex justify-between py-2 text-sm text-muted"><span>Shipping</span><span>{formatPeso(order.shippingCentavos)}</span></li>
        <li className="flex justify-between py-2 font-bold"><span>Total</span><span>{formatPeso(order.totalCentavos)}</span></li>
      </ul>
      {a ? (
        <section>
          <h2 className="text-sm font-semibold uppercase">Delivering to</h2>
          <p className="text-muted">{order.customerName}<br />{a.street}, {a.barangay}<br />{a.city}, {a.province} {a.zip}</p>
        </section>
      ) : null}
      <Link href="/shop" className={`${buttonPrimary} w-full`}>Continue shopping</Link>
    </div>
  )
}
