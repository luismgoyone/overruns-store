import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StatusBadge } from '@/components/admin/status-badge'
import { buttonPrimary, buttonSecondary } from '@/components/ui/styles'
import { nextStatuses } from '@/lib/admin/order-status'
import { requireAdmin } from '@/lib/auth/require-admin'
import { sizeLabel } from '@/lib/catalog/constants'
import { formatPeso } from '@/lib/money'
import { formatManilaDate, formatOrderNumber } from '@/lib/orders/format'
import { getOrderDetail } from '@/lib/orders/queries'
import { updateOrderStatus } from '../actions'

const actionLabel = { shipped: 'Mark as shipped', cancelled: 'Cancel order', paid: '', pending: '' } as const

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin()
  const order = await getOrderDetail(supabase, (await params).id)
  if (!order) notFound()
  const a = order.address
  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/orders" className="text-sm underline">← All orders</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl">Order {formatOrderNumber(order.id)}</h1>
        <StatusBadge status={order.status} />
      </div>
      {order.oversold ? (
        <p role="alert" className="border border-tag bg-card p-3 text-sm">
          This order was paid after stock ran out. Check the shelf before shipping, and refund it in the PayMongo dashboard if the item isn&apos;t there.
        </p>
      ) : null}
      <p className="text-sm text-muted">Placed {formatManilaDate(order.createdAt)}</p>
      <section className="space-y-1 border border-ink bg-card p-4 text-sm">
        <p className="font-semibold">{order.customerName}</p>
        <p>{order.phone} · {order.email}</p>
        {a ? <p className="text-muted">{a.street}, {a.barangay}, {a.city}, {a.province} {a.zip}</p> : null}
      </section>
      <ul className="divide-y divide-ink border-y border-ink text-sm">
        {order.items.map((i, idx) => <li key={idx} className="flex justify-between py-2"><span>{i.qty} × {i.productName} ({sizeLabel(i.size)})</span><span>{formatPeso(i.qty * i.priceCentavos)}</span></li>)}
        <li className="flex justify-between py-2 text-muted"><span>Shipping</span><span>{formatPeso(order.shippingCentavos)}</span></li>
        <li className="flex justify-between py-2 font-bold"><span>Total</span><span>{formatPeso(order.totalCentavos)}</span></li>
      </ul>
      <div className="flex gap-3">
        {nextStatuses(order.status).map((to) => (
          <form key={to} action={updateOrderStatus}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="from" value={order.status} />
            <input type="hidden" name="to" value={to} />
            <button type="submit" className={to === 'shipped' ? buttonPrimary : buttonSecondary}>{actionLabel[to]}</button>
          </form>
        ))}
      </div>
    </div>
  )
}
