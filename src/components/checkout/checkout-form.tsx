'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { startCheckout, type CheckoutActionState } from '@/app/(shop)/checkout/actions'
import { useCart } from '@/components/cart/cart-provider'
import { buttonPrimary, buttonSecondary, inputBase, monoLabel } from '@/components/ui/styles'
import { computeTotals } from '@/lib/cart/totals'
import { sizeLabel } from '@/lib/catalog/constants'
import { problemMessage } from '@/lib/checkout/problems'
import { SHIPPING_FEE_CENTAVOS } from '@/lib/config'
import { formatPeso } from '@/lib/money'

const fields = [
  { name: 'name', label: 'Full name', autoComplete: 'name', type: 'text' },
  { name: 'phone', label: 'Mobile number', autoComplete: 'tel', type: 'tel', placeholder: '0917 123 4567' },
  { name: 'email', label: 'Email', autoComplete: 'email', type: 'email' },
  { name: 'street', label: 'House no., street, building', autoComplete: 'address-line1', type: 'text' },
  { name: 'barangay', label: 'Barangay', autoComplete: 'address-line2', type: 'text' },
  { name: 'city', label: 'City / municipality', autoComplete: 'address-level2', type: 'text' },
  { name: 'province', label: 'Province', autoComplete: 'address-level1', type: 'text' },
  { name: 'zip', label: 'ZIP code', autoComplete: 'postal-code', type: 'text', inputMode: 'numeric' as const },
] as const

export function CheckoutForm() {
  const { lines, subtotal, hydrated, dispatch } = useCart()
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(startCheckout, { status: 'idle' })
  // Hide the problems banner once the shopper has applied its fixes, until the next submit.
  const [fixedState, setFixedState] = useState<CheckoutActionState | null>(null)
  if (!hydrated) return <p className="text-muted">Loading…</p>
  if (lines.length === 0) return <p className="border border-hairline bg-card p-6">Your cart is empty. <Link href="/shop" className="font-semibold underline underline-offset-4">Go shopping</Link></p>

  const totals = computeTotals(subtotal, SHIPPING_FEE_CENTAVOS)
  const errors = state.status === 'invalid' ? state.fieldErrors : {}
  const cartJson = JSON.stringify(lines.map((l) => ({ variantId: l.variantId, qty: l.qty, priceCentavos: l.priceCentavos })))

  const itemCount = lines.reduce((n, l) => n + l.qty, 0)
  const field = (f: (typeof fields)[number]) => {
    const err = errors[f.name]?.[0]
    const half = f.name === 'city' || f.name === 'province'
    return (
      <div key={f.name} className={`space-y-1.5 ${half ? '' : 'sm:col-span-2'}`}>
        <label htmlFor={f.name} className={`block ${monoLabel}`}>{f.label}</label>
        <input
          id={f.name} name={f.name} type={f.type} autoComplete={f.autoComplete}
          inputMode={'inputMode' in f ? f.inputMode : undefined}
          placeholder={'placeholder' in f ? f.placeholder : undefined}
          defaultValue={state.values?.[f.name] ?? ''}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${f.name}-error` : undefined}
          className={inputBase}
        />
        {err ? <p id={`${f.name}-error`} className="border-l-4 border-tag pl-2 text-sm font-semibold">{err}</p> : null}
      </div>
    )
  }

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1fr_400px] lg:items-start lg:gap-12" noValidate>
      <input type="hidden" name="cart" value={cartJson} />

      <div className="space-y-10">
        {state.status === 'cart_problems' && state !== fixedState ? (
          <div role="alert" className="space-y-3 border border-ink bg-card p-4">
            <p className="font-semibold">Some items changed since you added them:</p>
            <ul className="list-disc pl-5 text-sm">{state.problems.map((p) => <li key={p.variantId}>{problemMessage(p)}</li>)}</ul>
            <button type="button" className={buttonSecondary} onClick={() => { dispatch({ type: 'applyProblems', problems: state.problems }); setFixedState(state) }}>Update my cart</button>
          </div>
        ) : null}
        {state.status === 'error' ? <p role="alert" className="border border-tag bg-card p-3 text-sm">{state.message}</p> : null}

        <fieldset className="space-y-5">
          <legend className={`mb-5 w-full border-b border-hairline pb-3 font-mono text-sm font-bold uppercase tracking-[0.15em]`}>01 // Contact</legend>
          <div className="grid gap-5 sm:grid-cols-2">{fields.slice(0, 3).map(field)}</div>
        </fieldset>
        <fieldset className="space-y-5">
          <legend className={`mb-5 w-full border-b border-hairline pb-3 font-mono text-sm font-bold uppercase tracking-[0.15em]`}>02 // Delivery address</legend>
          <div className="grid gap-5 sm:grid-cols-2">{fields.slice(3).map(field)}</div>
        </fieldset>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-24">
        <section aria-labelledby="checkout-summary" className="space-y-4 border border-ink bg-card p-5 sm:p-6">
          <h2 id="checkout-summary" className="flex justify-between border-b border-hairline pb-3 font-mono text-sm font-bold uppercase tracking-[0.15em]">
            Order summary <span className="font-normal text-muted">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
          </h2>
          <ul className="space-y-3 text-sm">
            {lines.map((l) => (
              <li key={l.variantId} className="flex justify-between gap-3">
                <span><span className="font-display text-sm">{l.name}</span><br /><span className="font-mono text-xs uppercase text-muted">Size {sizeLabel(l.size)} · Qty {l.qty}</span></span>
                <span className="font-bold">{formatPeso(l.qty * l.priceCentavos)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-hairline pt-3 text-sm">
            <div className="flex justify-between text-muted"><dt>Subtotal</dt><dd className="text-ink">{formatPeso(totals.subtotal)}</dd></div>
            <div className="flex justify-between text-muted"><dt>Shipping (flat)</dt><dd className="text-ink">{formatPeso(totals.shipping)}</dd></div>
            <div className="flex items-baseline justify-between border-t border-hairline pt-3"><dt className="font-display text-base">Total</dt><dd className="font-display text-2xl tracking-tight">{formatPeso(totals.total)}</dd></div>
          </dl>
        </section>

        <div className="space-y-3">
          <button type="submit" disabled={pending} className={`${buttonPrimary} w-full`}>{pending ? 'Opening PayMongo…' : 'Pay with PayMongo'}</button>
          <p className="flex flex-wrap justify-center gap-2">
            {['GCash', 'Maya', 'Card', 'QR Ph'].map((m) => <span key={m} className="border border-hairline bg-card px-2 py-1 font-mono text-[11px] uppercase tracking-[0.1em]">{m}</span>)}
          </p>
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Test mode: no real money is charged.</p>
        </div>
      </aside>
    </form>
  )
}
