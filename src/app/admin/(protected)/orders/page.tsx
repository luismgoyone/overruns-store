import Link from 'next/link'
import { StatusBadge } from '@/components/admin/status-badge'
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
      <h1 className="font-display text-2xl">Orders</h1>
      <nav className="flex flex-wrap gap-2 text-sm">
        {[null, ...ORDER_STATUSES].map((s) => (
          <Link key={s ?? 'all'} href={s ? `/admin/orders?status=${s}` : '/admin/orders'} className={`flex h-11 items-center border border-ink px-3 uppercase ${filter === s ? 'bg-ink text-paper' : 'bg-card'}`}>{s ?? 'All'}</Link>
        ))}
      </nav>
      {orders.length === 0 ? <p className="text-muted">No orders yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border border-ink bg-card text-sm">
            <thead className="border-b border-ink text-left"><tr><th className="p-2">Order #</th><th className="p-2">Customer</th><th className="p-2">Total</th><th className="p-2">Status</th><th className="p-2">Date</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-ink/20">
                  <td className="p-2"><Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold underline">{formatOrderNumber(o.id)}</Link></td>
                  <td className="p-2">{o.customer_name}</td>
                  <td className="p-2">{formatPeso(o.total_centavos)}</td>
                  <td className="p-2"><StatusBadge status={o.status} />{o.oversold ? <span className="ml-2 border border-tag px-1 text-xs font-bold uppercase">Oversold</span> : null}</td>
                  <td className="p-2 text-muted">{formatManilaDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
