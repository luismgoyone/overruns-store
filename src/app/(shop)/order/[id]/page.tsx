import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClearCartOnMount } from '@/components/cart/clear-cart-on-mount'
import { PendingRefresher } from '@/components/order/pending-refresher'
import { StatusBadge } from '@/components/ui/status-badge'
import { buttonInk } from '@/components/ui/styles'
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
    <div className="px-4 pt-8 sm:px-8 sm:pt-12">
      <div className="mx-auto max-w-2xl space-y-8 border border-hairline bg-card p-5 sm:p-12">
        {/* PayMongo only redirects here after payment; a cancelled order shouldn't wipe the cart. */}
        {order.status !== 'cancelled' ? <ClearCartOnMount /> : null}
        <div className="space-y-4 text-center">
          {paidOrLater ? (
            <div aria-hidden className="mx-auto flex h-16 w-16 items-center justify-center bg-ink text-paper">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </div>
          ) : null}
          <p className="flex flex-wrap items-center justify-center gap-2">
            <span className="border border-hairline bg-paper px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.15em]">Order <strong>{formatOrderNumber(order.id)}</strong></span>
            <StatusBadge status={order.status} />
          </p>
          {paidOrLater ? (
            <h1 className="font-display text-2xl sm:text-3xl">Salamat! Your order is confirmed</h1>
          ) : order.status === 'cancelled' ? (
            <h1 className="font-display text-2xl sm:text-3xl">This order was cancelled</h1>
          ) : (
            <div className="space-y-2">
              <h1 className="font-display text-2xl sm:text-3xl">Almost there</h1>
              <PendingRefresher />
            </div>
          )}
        </div>

        <section aria-labelledby="order-items" className="space-y-3 border-t border-hairline pt-6">
          <h2 id="order-items" className="font-mono text-sm font-bold uppercase tracking-[0.15em]">Items</h2>
          <ul className="divide-y divide-hairline">
            {order.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-4 py-3">
                <span><span className="font-display text-base">{i.productName}</span><br /><span className="font-mono text-xs uppercase tracking-[0.1em] text-muted">Size {sizeLabel(i.size)} · Qty {i.qty}</span></span>
                <span className="font-bold">{formatPeso(i.qty * i.priceCentavos)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-hairline pt-4">
            <div className="flex justify-between text-muted"><dt>Shipping</dt><dd>{formatPeso(order.shippingCentavos)}</dd></div>
            <div className="flex items-baseline justify-between"><dt className="font-display text-lg">Total</dt><dd className="font-display text-2xl tracking-tight">{formatPeso(order.totalCentavos)}</dd></div>
          </dl>
        </section>

        {a ? (
          <section aria-labelledby="order-address" className="space-y-3 border-t border-hairline pt-6">
            <h2 id="order-address" className="font-mono text-sm font-bold uppercase tracking-[0.15em]">Delivering to</h2>
            <div className="border border-hairline bg-paper p-4 sm:p-5">
              <p className="font-display text-base">{order.customerName}</p>
              <p className="text-muted">{a.street}, {a.barangay}<br />{a.city}, {a.province} {a.zip}</p>
            </div>
          </section>
        ) : null}
        <div className="border-t border-hairline pt-6 text-center">
          <Link href="/shop" className={`${buttonInk} w-full sm:w-auto`}>Continue shopping</Link>
        </div>
      </div>
    </div>
  )
}
