import type { OrderStatus } from '@/lib/catalog/constants'

const styles: Record<OrderStatus, string> = {
  pending: 'bg-paper text-muted border-muted',
  paid: 'bg-tag text-ink border-ink',
  shipped: 'bg-ink text-paper border-ink',
  cancelled: 'bg-card text-muted border-muted line-through',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-block border px-2 py-0.5 text-xs font-bold uppercase ${styles[status]}`}>{status}</span>
}
