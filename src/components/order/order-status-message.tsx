import type { OrderStatus } from '@/lib/catalog/constants'
import { PendingRefresher } from './pending-refresher'

const heading = 'font-display text-2xl sm:text-3xl'
const note = 'mx-auto max-w-md border border-tag bg-tag/10 p-3 text-sm'

export function OrderStatusMessage({ status, oversold, paymentConflict }: { status: OrderStatus; oversold: boolean; paymentConflict: boolean }) {
  if (status === 'paid' || status === 'shipped') {
    return (
      <div className="space-y-3">
        <h1 className={heading}>Salamat! Your order is confirmed</h1>
        {oversold ? <p role="status" className={note}>We&apos;re double-checking stock for one item — we&apos;ll contact you within 24h. If it&apos;s gone, you&apos;ll get a full refund for it.</p> : null}
      </div>
    )
  }
  if (status === 'cancelled') {
    return paymentConflict ? (
      <div className="space-y-3">
        <h1 className={heading}>We received your payment</h1>
        <p role="status" className={note}>This order had already been cancelled when your payment came through. We&apos;ll contact you within 24h to either send your order or refund you in full.</p>
      </div>
    ) : (
      <h1 className={heading}>This order was cancelled</h1>
    )
  }
  return (
    <div className="space-y-2">
      <h1 className={heading}>Almost there</h1>
      <PendingRefresher />
    </div>
  )
}
