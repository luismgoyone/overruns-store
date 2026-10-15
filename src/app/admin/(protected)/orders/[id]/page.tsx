import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminHeader, adminTitle, panel, panelTitle, table, td, th } from '@/components/admin/admin-ui'
import { StatusBadge } from '@/components/ui/status-badge'
import { buttonPrimary, buttonSecondary, monoLabel } from '@/components/ui/styles'
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
  const actions = nextStatuses(order.status)
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/orders" className="inline-flex h-11 items-center font-mono text-xs uppercase tracking-[0.15em] underline-offset-4 hover:underline">← All orders</Link>
      <div className={adminHeader}>
        <div className="space-y-2">
          <p className={`${monoLabel} text-muted`}>Placed {formatManilaDate(order.createdAt)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={adminTitle}>Order {formatOrderNumber(order.id)}</h1>
            <StatusBadge status={order.status} />
          </div>
        </div>
      </div>
      {order.oversold ? (
        <p role="alert" className="flex gap-3 border border-tag bg-tag/10 p-4 text-sm">
          <span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 bg-tag" />
          <span><strong className="font-mono text-xs uppercase tracking-[0.15em] text-tag-ink">Oversold. </strong>This order was paid after stock ran out. Check the shelf before shipping, and refund it in the PayMongo dashboard if the item isn&apos;t there.</span>
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <section className={`${panel} space-y-3 text-sm`}>
          <h2 className={panelTitle}>Customer</h2>
          <p className="font-semibold">{order.customerName}</p>
          <p className="break-words">{order.phone}<br />{order.email}</p>
        </section>
        <section className={`${panel} space-y-3 text-sm`}>
          <h2 className={panelTitle}>Delivery address</h2>
          {a ? <p>{a.street}, {a.barangay}<br />{a.city}, {a.province} {a.zip}</p> : <p className="text-muted">No address on file.</p>}
        </section>
      </div>
      <section className="space-y-3">
        <h2 className="font-display text-lg">Items</h2>
        <div className="overflow-x-auto">
          <table className={`${table} min-w-[480px]`}>
            <thead><tr><th className={th}>Product</th><th className={th}>Size</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Amount</th></tr></thead>
            <tbody className="divide-y divide-hairline">
              {order.items.map((i, idx) => (
                <tr key={idx}>
                  <td className={`${td} font-display uppercase`}>{i.productName}</td>
                  <td className={`${td} font-mono text-xs uppercase`}>{sizeLabel(i.size)}</td>
                  <td className={`${td} text-right font-mono`}>{i.qty}</td>
                  <td className={`${td} text-right font-mono`}>{formatPeso(i.qty * i.priceCentavos)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-hairline">
              <tr className="text-muted"><td className={td} colSpan={3}>Shipping</td><td className={`${td} text-right font-mono`}>{formatPeso(order.shippingCentavos)}</td></tr>
              <tr className="border-t border-hairline"><td className={`${td} font-display text-base`} colSpan={3}>Total</td><td className={`${td} text-right font-mono text-base font-bold`}>{formatPeso(order.totalCentavos)}</td></tr>
            </tfoot>
          </table>
        </div>
      </section>
      {actions.length > 0 ? (
        <section className={`${panel} space-y-4`}>
          <h2 className={panelTitle}>Update status</h2>
          <div className="flex flex-wrap gap-3">
            {actions.map((to) => (
              <form key={to} action={updateOrderStatus}>
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="from" value={order.status} />
                <input type="hidden" name="to" value={to} />
                <button type="submit" className={to === 'shipped' ? buttonPrimary : buttonSecondary}>{actionLabel[to]}</button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
