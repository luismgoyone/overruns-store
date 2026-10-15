import Link from 'next/link'
import { adminHeader, adminTitle, table, td, th } from '@/components/admin/admin-ui'
import { StatusBadge } from '@/components/ui/status-badge'
import { monoLabel } from '@/components/ui/styles'
import { ORDER_STATUSES } from '@/lib/admin/order-status'
import { requireAdmin } from '@/lib/auth/require-admin'
import { formatPeso } from '@/lib/money'
import { formatManilaDate, formatOrderNumber } from '@/lib/orders/format'

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase } = await requireAdmin()
  const { status } = await searchParams
  const filter = ORDER_STATUSES.find((s) => s === status) ?? null
  let query = supabase.from('orders').select('id, customer_name, total_centavos, status, oversold, created_at').order('created_at', { ascending: false }).limit(200)
  if (filter) query = query.eq('status', filter)
  const { data: orders, error } = await query
  if (error) throw error

  return (
    <div className="space-y-6">
      <div className={adminHeader}>
        <div className="space-y-1">
          <p className={`${monoLabel} text-muted`}>{orders.length} {filter ?? ''} {orders.length === 1 ? 'order' : 'orders'}</p>
          <h1 className={adminTitle}>Orders</h1>
        </div>
      </div>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {[null, ...ORDER_STATUSES].map((s) => (
          <Link key={s ?? 'all'} href={s ? `/admin/orders?status=${s}` : '/admin/orders'} className={`flex h-11 items-center border px-4 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${filter === s ? 'border-ink bg-ink text-paper' : 'border-hairline bg-card hover:border-ink'}`} aria-current={filter === s ? 'page' : undefined}>{s ?? 'All'}</Link>
        ))}
      </nav>
      {orders.length === 0 ? <p className="border border-hairline bg-card p-6 text-muted">{filter ? `No ${filter} orders.` : 'No orders yet.'}</p> : (
        <div className="overflow-x-auto">
          <table className={`${table} min-w-[680px]`}>
            <thead><tr><th className={th}>Order #</th><th className={th}>Customer</th><th className={th}>Total</th><th className={th}>Status</th><th className={th}>Date</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y divide-hairline">
              {orders.map((o) => (
                <tr key={o.id} className={o.oversold ? 'bg-tag/5' : 'hover:bg-paper/60'}>
                  <td className={td}><Link href={`/admin/orders/${o.id}`} className="inline-flex h-11 items-center font-mono font-bold underline-offset-4 hover:underline">{formatOrderNumber(o.id)}</Link></td>
                  <td className={td}>{o.customer_name}</td>
                  <td className={`${td} font-mono font-bold whitespace-nowrap`}>{formatPeso(o.total_centavos)}</td>
                  <td className={td}>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={o.status} />
                      {o.oversold ? <span className="border border-tag bg-card px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-tag-ink">Oversold</span> : null}
                    </span>
                  </td>
                  <td className={`${td} font-mono text-xs uppercase text-muted whitespace-nowrap`}>{formatManilaDate(o.created_at)}</td>
                  <td className={`${td} text-right`}><Link href={`/admin/orders/${o.id}`} aria-label={`View order ${formatOrderNumber(o.id)}`} className="inline-flex h-11 items-center font-mono text-xs font-bold uppercase tracking-[0.15em] underline underline-offset-4">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
