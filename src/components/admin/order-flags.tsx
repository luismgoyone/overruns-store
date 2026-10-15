import type { OrderStatus } from '@/lib/catalog/constants'

const flag = 'inline-block border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em]'

/** Badges for orders that need the owner's attention. */
export function OrderFlags({ status, oversold, paymentConflict, amountMismatch }: { status: OrderStatus; oversold: boolean; paymentConflict: boolean; amountMismatch: boolean }) {
  return (
    <>
      {paymentConflict && status === 'cancelled' ? <span className={`${flag} border-ink bg-tag text-ink`}>Paid after cancel</span> : null}
      {amountMismatch ? <span className={`${flag} border-tag bg-card text-tag-ink`}>Amount mismatch</span> : null}
      {oversold ? <span className={`${flag} border-tag bg-card text-tag-ink`}>Oversold</span> : null}
    </>
  )
}

export const needsAttention = (o: { status: OrderStatus; oversold: boolean; paymentConflict: boolean; amountMismatch: boolean }) =>
  o.oversold || o.amountMismatch || (o.paymentConflict && o.status === 'cancelled')
