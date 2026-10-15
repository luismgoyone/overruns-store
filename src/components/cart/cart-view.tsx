'use client'

import Image from 'next/image'
import Link from 'next/link'
import { buttonPrimary, monoLabel } from '@/components/ui/styles'
import { MAX_QTY_PER_LINE } from '@/lib/cart/cart'
import { computeTotals } from '@/lib/cart/totals'
import { sizeLabel } from '@/lib/catalog/constants'
import { productImageUrl } from '@/lib/catalog/images'
import { SHIPPING_FEE_CENTAVOS } from '@/lib/config'
import { formatPeso } from '@/lib/money'
import { useCart } from './cart-provider'

const stepBtn = 'flex h-11 w-11 items-center justify-center text-lg hover:bg-paper disabled:text-muted/50 disabled:hover:bg-transparent'

export function CartView({ cancelled }: { cancelled: boolean }) {
  const { lines, count, subtotal, hydrated, dispatch } = useCart()
  if (!hydrated) return <p className="px-4 py-10 text-muted sm:px-8">Loading cart…</p>
  const totals = computeTotals(subtotal, SHIPPING_FEE_CENTAVOS)

  return (
    <div className="space-y-6 px-4 pt-8 sm:px-8 lg:pt-12">
      <div className="space-y-1 border-b border-hairline pb-5">
        <p className={`${monoLabel} text-muted`}>{count} {count === 1 ? 'item' : 'items'}</p>
        <h1 className="font-display text-3xl lg:text-5xl">Your cart</h1>
      </div>
      {cancelled ? (
        <p role="status" className="border border-ink bg-card p-4 text-sm">Payment was cancelled. Your cart is still here whenever you&apos;re ready.</p>
      ) : null}
      {lines.length === 0 ? (
        <div className="space-y-6 border border-hairline bg-card px-6 py-16 text-center">
          <p className="font-display text-xl">Your cart is empty.</p>
          <Link href="/shop" className={buttonPrimary}>Shop the drop</Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-10">
          <div className="space-y-6">
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={l.variantId} className="flex gap-4 border border-hairline bg-card p-3 sm:p-4">
                  <div className="relative h-24 w-24 shrink-0 border border-hairline bg-paper">
                    {l.image ? <Image src={productImageUrl(l.image)} alt="" fill sizes="96px" className="object-cover" /> : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex justify-between gap-2">
                        <Link href={`/product/${l.slug}`} className="font-display text-base leading-snug hover:underline hover:underline-offset-4 sm:text-lg">{l.name}</Link>
                        <span className="font-bold sm:hidden">{formatPeso(l.priceCentavos * l.qty)}</span>
                      </div>
                      <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted">Size {sizeLabel(l.size)} · {formatPeso(l.priceCentavos)} each</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:gap-6">
                      <div className="flex items-center border border-ink bg-card">
                        <button type="button" aria-label={`Decrease quantity of ${l.name}, size ${sizeLabel(l.size)}`} className={stepBtn} onClick={() => dispatch({ type: 'setQty', variantId: l.variantId, qty: l.qty - 1 })}>−</button>
                        <span className="w-8 text-center font-mono" aria-live="polite" aria-label={`Quantity ${l.qty}`}>{l.qty}</span>
                        <button type="button" aria-label={`Increase quantity of ${l.name}, size ${sizeLabel(l.size)}`} className={stepBtn} disabled={l.qty >= Math.min(l.maxQty, MAX_QTY_PER_LINE)} onClick={() => dispatch({ type: 'setQty', variantId: l.variantId, qty: l.qty + 1 })}>+</button>
                      </div>
                      <span className="hidden w-24 text-right text-lg font-bold sm:block">{formatPeso(l.priceCentavos * l.qty)}</span>
                      <button type="button" className="h-11 px-1 font-mono text-xs font-bold uppercase tracking-[0.15em] text-tag-ink hover:underline hover:underline-offset-4" aria-label={`Remove ${l.name}, size ${sizeLabel(l.size)}`} onClick={() => dispatch({ type: 'remove', variantId: l.variantId })}>Remove</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/shop" className="hidden h-11 items-center gap-3 font-mono text-xs uppercase tracking-[0.15em] hover:underline hover:underline-offset-4 lg:inline-flex">← Continue shopping</Link>
          </div>
          <section aria-labelledby="cart-summary" className="space-y-5 border border-ink bg-card p-5 sm:p-8 lg:sticky lg:top-24">
            <h2 id="cart-summary" className="border-b border-hairline pb-4 font-display text-xl">Order summary</h2>
            <dl className="space-y-3">
              <div className="flex justify-between text-muted"><dt>Subtotal</dt><dd data-testid="subtotal" className="font-semibold text-ink">{formatPeso(totals.subtotal)}</dd></div>
              <div className="flex justify-between text-muted"><dt>Shipping (flat)</dt><dd data-testid="shipping" className="font-semibold text-ink">{formatPeso(totals.shipping)}</dd></div>
              <div className="flex items-baseline justify-between border-t border-hairline pt-4"><dt className="font-display text-lg">Total</dt><dd data-testid="total" className="font-display text-3xl tracking-tight">{formatPeso(totals.total)}</dd></div>
            </dl>
            <Link href="/checkout" className={`${buttonPrimary} w-full`}>Checkout</Link>
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Pay with GCash, Maya or card via PayMongo</p>
          </section>
        </div>
      )}
    </div>
  )
}
