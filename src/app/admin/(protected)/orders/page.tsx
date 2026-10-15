import Link from 'next/link'
import { adminHeader, adminTitle, table, td, th } from '@/components/admin/admin-ui'
import { needsAttention, OrderFlags } from '@/components/admin/order-flags'
import { StatusBadge } from '@/components/ui/status-badge'
import { monoLabel } from '@/components/ui/styles'
import { ORDERS_PER_PAGE, orderListHref, parseOrderListParams, STALE_PENDING_HOURS } from '@/lib/admin/order-list'
import { ORDER_STATUSES } from '@/lib/admin/order-status'
import { requireAdmin } from '@/lib/auth/require-admin'
import { formatPeso } from '@/lib/money'
import { formatManilaDate, formatOrderNumber } from '@/lib/orders/format'

const chip = 'flex h-11 items-center border px-4 font-mono text-xs uppercase tracking-[0.15em] transition-colors'
const chipOn = 'border-ink bg-ink text-paper'
const chipOff = 'border-hairline bg-card hover:border-ink'

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; stale?: string }> }) {
  const { supabase } = await requireAdmin()
  const p = parseOrderListParams(await searchParams)
  const { status: filter, page, showStale } = p
  let query = supabase
    .from('orders')
    .select('id, customer_name, total_centavos, status, oversold, payment_conflict, amount_mismatch, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(p.from, p.to)
  if (filter) query = query.eq('status', filter)
  // Abandoned checkouts pile up as pending; hide them unless asked (the daily cron cancels them).
  if (!showStale && (filter === null || filter === 'pending')) query = query.or(`status.neq.pending,created_at.gte.${p.staleBefore}`)
  const { data: orders, error, count } = await query
  if (error) throw error
  const total = count ?? orders.length
  const lastPage = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE))
  const staleToggleShown = filter === null || filter === 'pending'

  return (
    <div className="space-y-6">
      <div className={adminHeader}>
        <div className="space-y-1">
          <p className={`${monoLabel} text-muted`}>{total} {filter ?? ''} {total === 1 ? 'order' : 'orders'}</p>
          <h1 className={adminTitle}>Orders</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          {[null, ...ORDER_STATUSES].map((s) => (
            <Link key={s ?? 'all'} href={orderListHref({ status: s, page: 1, showStale })} className={`${chip} ${filter === s ? chipOn : chipOff}`} aria-current={filter === s ? 'page' : undefined}>{s ?? 'All'}</Link>
          ))}
        </nav>
        {staleToggleShown ? (
          <Link href={orderListHref({ status: filter, page: 1, showStale: !showStale })} className={`${chip} ${showStale ? chipOn : chipOff}`} aria-pressed={showStale}>
            {showStale ? 'Hide' : 'Show'} stale pending
          </Link>
        ) : null}
      </div>
      {!showStale && staleToggleShown ? <p className="text-sm text-muted">Pending orders older than {STALE_PENDING_HOURS} hours are hidden. They are abandoned checkouts and get cancelled automatically.</p> : null}
      {orders.length === 0 ? <p className="border border-hairline bg-card p-6 text-muted">{filter ? `No ${filter} orders.` : 'No orders yet.'}</p> : (
        <div className="overflow-x-auto">
          <table className={`${table} min-w-[680px]`}>
            <thead><tr><th className={th}>Order #</th><th className={th}>Customer</th><th className={th}>Total</th><th className={th}>Status</th><th className={th}>Date</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y divide-hairline">
              {orders.map((o) => {
                const flags = { status: o.status, oversold: o.oversold, paymentConflict: o.payment_conflict, amountMismatch: o.amount_mismatch }
                return (
                  <tr key={o.id} className={needsAttention(flags) ? 'bg-tag/5' : 'hover:bg-paper/60'}>
                    <td className={td}><Link href={`/admin/orders/${o.id}`} className="inline-flex h-11 items-center font-mono font-bold underline-offset-4 hover:underline">{formatOrderNumber(o.id)}</Link></td>
                    <td className={td}>{o.customer_name}</td>
                    <td className={`${td} font-mono font-bold whitespace-nowrap`}>{formatPeso(o.total_centavos)}</td>
                    <td className={td}>
                      <span className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={o.status} />
                        <OrderFlags {...flags} />
                      </span>
                    </td>
                    <td className={`${td} font-mono text-xs uppercase text-muted whitespace-nowrap`}>{formatManilaDate(o.created_at)}</td>
                    <td className={`${td} text-right`}><Link href={`/admin/orders/${o.id}`} aria-label={`View order ${formatOrderNumber(o.id)}`} className="inline-flex h-11 items-center font-mono text-xs font-bold uppercase tracking-[0.15em] underline underline-offset-4">View</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {lastPage > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          {page > 1 ? <Link href={orderListHref({ status: filter, page: page - 1, showStale })} className={`${chip} ${chipOff}`}>← Newer</Link> : <span />}
          <p className={`${monoLabel} text-muted`}>Page {page} of {lastPage}</p>
          {page < lastPage ? <Link href={orderListHref({ status: filter, page: page + 1, showStale })} className={`${chip} ${chipOff}`}>Older →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  )
}
