import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminHeader, adminTitle, panel, panelTitle, table, td, th } from '@/components/admin/admin-ui'
import { OrderFlags } from '@/components/admin/order-flags'
import { StatusBadge } from '@/components/ui/status-badge'
import { buttonInk, buttonPrimary, buttonSecondary, monoLabel } from '@/components/ui/styles'
import { nextStatuses } from '@/lib/admin/order-status'
import { requireAdmin } from '@/lib/auth/require-admin'
import { sizeLabel } from '@/lib/catalog/constants'
import { formatPeso } from '@/lib/money'
import { formatManilaDate, formatOrderNumber } from '@/lib/orders/format'
import { getOrderDetail } from '@/lib/orders/queries'
import { acceptConflictedPayment, recheckPayment, resendConfirmation, updateOrderStatus } from '../actions'

const actionLabel = { shipped: 'Mark as shipped', cancelled: 'Cancel order', paid: '', pending: '' } as const

// Result of the last admin action, passed back in ?notice=. `warn` notices are shown in orange.
const NOTICES: Record<string, { text: string; warn?: boolean }> = {
  cancelled: { text: 'Order cancelled and its PayMongo payment page closed.' },
  'already-paid': { text: 'PayMongo says this order was already paid, so it was NOT cancelled. It is now marked paid; ship it or refund it in PayMongo.', warn: true },
  'cancel-failed': { text: "Couldn't reach PayMongo to close the payment page, so the order was NOT cancelled. Try again in a minute.", warn: true },
  'not-pending': { text: 'This order is no longer pending, so nothing changed.' },
  'recheck-paid': { text: 'PayMongo confirms the payment. The order is now paid.' },
  'recheck-pending': { text: 'PayMongo has no payment for this order yet.' },
  'recheck-not-pending': { text: 'This order is no longer pending.' },
  'recheck-no-session': { text: 'This order never reached the PayMongo payment page.' },
  'recheck-not-found': { text: 'Order not found.', warn: true },
  'recheck-error': { text: "Couldn't reach PayMongo. Try again in a minute.", warn: true },
  'recheck-skipped': { text: 'PayMongo is not configured (PAYMONGO_SECRET_KEY), so payment could not be checked.', warn: true },
  resent: { text: 'Confirmation email sent.' },
  'resend-failed': { text: "The confirmation email couldn't be sent. Check the Resend settings and try again.", warn: true },
  fulfilled: { text: 'Order marked paid and stock taken. Ship it as usual.' },
  'not-conflicted': { text: 'This order has no payment conflict, so nothing changed.' },
}

function Alert({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 border border-tag bg-tag/10 p-4 text-sm">
      <span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 bg-tag" />
      <div className="space-y-3"><p><strong className="font-mono text-xs uppercase tracking-[0.15em] text-tag-ink">{label} </strong>{children}</p></div>
    </div>
  )
}

export default async function AdminOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { supabase } = await requireAdmin()
  const order = await getOrderDetail(supabase, (await params).id)
  if (!order) notFound()
  const notice = NOTICES[(await searchParams).notice ?? '']
  const a = order.address
  const actions = nextStatuses(order.status)
  const conflict = order.paymentConflict && order.status === 'cancelled'
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/orders" className="inline-flex h-11 items-center font-mono text-xs uppercase tracking-[0.15em] underline-offset-4 hover:underline">← All orders</Link>
      <div className={adminHeader}>
        <div className="space-y-2">
          <p className={`${monoLabel} text-muted`}>Placed {formatManilaDate(order.createdAt)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={adminTitle}>Order {formatOrderNumber(order.id)}</h1>
            <StatusBadge status={order.status} />
            <OrderFlags status={order.status} oversold={order.oversold} paymentConflict={order.paymentConflict} amountMismatch={order.amountMismatch} />
          </div>
        </div>
      </div>
      {notice ? (
        <p role="status" className={`border p-4 text-sm ${notice.warn ? 'border-tag bg-tag/10 font-semibold' : 'border-ink bg-card'}`}>{notice.text}</p>
      ) : null}
      {conflict ? (
        <div role="alert" className="space-y-3 border-2 border-ink bg-tag p-4 text-sm text-ink">
          <p><strong className="font-mono text-xs uppercase tracking-[0.15em]">Paid after cancel — refund in PayMongo or fulfil. </strong>PayMongo took a payment{order.paidAt ? ` on ${formatManilaDate(order.paidAt)}` : ''} after this order was cancelled. Stock was not taken. Refund it in the PayMongo dashboard, or fulfil it below (marks it paid and takes stock).</p>
          <form action={acceptConflictedPayment}>
            <input type="hidden" name="id" value={order.id} />
            <button type="submit" className={buttonInk}>Fulfil instead (mark paid)</button>
          </form>
        </div>
      ) : null}
      {order.amountMismatch ? (
        <Alert label="Amount mismatch.">The amount or currency PayMongo reported doesn&apos;t match this order&apos;s total. Compare the payment in the PayMongo dashboard before shipping.</Alert>
      ) : null}
      {order.oversold ? (
        <Alert label="Oversold.">This order was paid after stock ran out. Check the shelf before shipping, and refund it in the PayMongo dashboard if the item isn&apos;t there.</Alert>
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
      {order.status === 'pending' ? (
        <section className={`${panel} space-y-4`}>
          <h2 className={panelTitle}>Payment</h2>
          <p className="text-sm text-muted">Waiting for PayMongo. If the customer says they paid, ask PayMongo directly.</p>
          <form action={recheckPayment}>
            <input type="hidden" name="id" value={order.id} />
            <button type="submit" className={buttonSecondary}>Re-check payment</button>
          </form>
        </section>
      ) : null}
      {order.status === 'paid' || order.status === 'shipped' ? (
        <section className={`${panel} space-y-4`}>
          <h2 className={panelTitle}>Confirmation email</h2>
          <p className="text-sm text-muted">{order.confirmationSentAt ? `Sent ${formatManilaDate(order.confirmationSentAt)}.` : 'Not sent yet.'}</p>
          <form action={resendConfirmation}>
            <input type="hidden" name="id" value={order.id} />
            <button type="submit" className={buttonSecondary}>{order.confirmationSentAt ? 'Resend confirmation' : 'Send confirmation'}</button>
          </form>
        </section>
      ) : null}
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
