import type { OrderStatus } from '@/lib/catalog/constants'

const styles: Record<OrderStatus, string> = {
  pending: 'border-hairline bg-paper text-muted',
  paid: 'border-tag bg-tag text-ink',
  shipped: 'border-ink bg-ink text-paper',
  cancelled: 'border-hairline bg-card text-muted line-through',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-block border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] ${styles[status]}`}>{status}</span>
}
