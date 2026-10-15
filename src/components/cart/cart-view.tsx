'use client'

import Image from 'next/image'
import Link from 'next/link'
import { buttonPrimary } from '@/components/ui/styles'
import { MAX_QTY_PER_LINE } from '@/lib/cart/cart'
import { computeTotals } from '@/lib/cart/totals'
import { sizeLabel } from '@/lib/catalog/constants'
import { productImageUrl } from '@/lib/catalog/images'
import { SHIPPING_FEE_CENTAVOS } from '@/lib/config'
import { formatPeso } from '@/lib/money'
import { useCart } from './cart-provider'

const stepBtn = 'flex h-11 w-11 items-center justify-center border border-ink text-lg disabled:border-muted/50 disabled:text-muted'

export function CartView({ cancelled }: { cancelled: boolean }) {
  const { lines, subtotal, hydrated, dispatch } = useCart()
  if (!hydrated) return <p className="px-4 py-10 text-muted">Loading cart…</p>
  const totals = computeTotals(subtotal, SHIPPING_FEE_CENTAVOS)

  return (
    <div className="space-y-6 px-4 py-6">
      <h1 className="font-display text-2xl">Your cart</h1>
      {cancelled ? (
        <p role="status" className="border border-ink bg-card p-3 text-sm">Payment was cancelled. Your cart is still here whenever you&apos;re ready.</p>
      ) : null}
      {lines.length === 0 ? (
        <div className="space-y-4 py-10 text-center">
          <p>Your cart is empty.</p>
          <Link href="/shop" className={buttonPrimary}>Shop the drop</Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-ink border-y border-ink">
            {lines.map((l) => (
              <li key={l.variantId} className="flex gap-3 py-4">
                <div className="relative h-24 w-24 shrink-0 border border-ink bg-card">
                  {l.image ? <Image src={productImageUrl(l.image)} alt="" fill sizes="96px" className="object-cover" /> : null}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex justify-between gap-2">
                    <Link href={`/product/${l.slug}`} className="font-semibold">{l.name}</Link>
                    <span className="font-bold">{formatPeso(l.priceCentavos * l.qty)}</span>
                  </div>
                  <p className="text-sm text-muted">Size {sizeLabel(l.size)} · {formatPeso(l.priceCentavos)} each</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <button type="button" aria-label="Decrease quantity" className={stepBtn} onClick={() => dispatch({ type: 'setQty', variantId: l.variantId, qty: l.qty - 1 })}>−</button>
                      <span className="w-10 text-center" aria-live="polite">{l.qty}</span>
                      <button type="button" aria-label="Increase quantity" className={stepBtn} disabled={l.qty >= Math.min(l.maxQty, MAX_QTY_PER_LINE)} onClick={() => dispatch({ type: 'setQty', variantId: l.variantId, qty: l.qty + 1 })}>+</button>
                    </div>
                    <button type="button" className="h-11 px-2 text-sm underline" onClick={() => dispatch({ type: 'remove', variantId: l.variantId })}>Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border border-ink bg-card p-4">
            <div className="flex justify-between"><dt>Subtotal</dt><dd data-testid="subtotal">{formatPeso(totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping (flat)</dt><dd data-testid="shipping">{formatPeso(totals.shipping)}</dd></div>
            <div className="flex justify-between border-t border-ink pt-2 text-lg font-bold"><dt>Total</dt><dd data-testid="total">{formatPeso(totals.total)}</dd></div>
          </dl>
          <Link href="/checkout" className={`${buttonPrimary} w-full`}>Checkout</Link>
        </>
      )}
    </div>
  )
}
