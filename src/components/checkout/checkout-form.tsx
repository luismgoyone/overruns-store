'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { startCheckout, type CheckoutActionState } from '@/app/(shop)/checkout/actions'
import { useCart } from '@/components/cart/cart-provider'
import { buttonPrimary, buttonSecondary, inputBase } from '@/components/ui/styles'
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
  if (!hydrated) return <p className="text-muted">Loading…</p>
  if (lines.length === 0) return <p>Your cart is empty. <Link href="/shop" className="underline">Go shopping</Link></p>

  const totals = computeTotals(subtotal, SHIPPING_FEE_CENTAVOS)
  const errors = state.status === 'invalid' ? state.fieldErrors : {}
  const cartJson = JSON.stringify(lines.map((l) => ({ variantId: l.variantId, qty: l.qty, priceCentavos: l.priceCentavos })))

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="cart" value={cartJson} />

      {state.status === 'cart_problems' ? (
        <div role="alert" className="space-y-3 border border-ink bg-card p-4">
          <p className="font-semibold">Some items changed since you added them:</p>
          <ul className="list-disc pl-5 text-sm">{state.problems.map((p) => <li key={p.variantId}>{problemMessage(p)}</li>)}</ul>
          <button type="button" className={buttonSecondary} onClick={() => dispatch({ type: 'applyProblems', problems: state.problems })}>Update my cart</button>
        </div>
      ) : null}
      {state.status === 'error' ? <p role="alert" className="border border-tag bg-card p-3 text-sm">{state.message}</p> : null}

      <fieldset className="space-y-4">
        <legend className="font-display text-lg">Contact and delivery</legend>
        {fields.map((f) => {
          const err = errors[f.name]?.[0]
          return (
            <div key={f.name} className="space-y-1">
              <label htmlFor={f.name} className="text-sm font-semibold">{f.label}</label>
              <input
                id={f.name} name={f.name} type={f.type} autoComplete={f.autoComplete}
                inputMode={'inputMode' in f ? f.inputMode : undefined}
                placeholder={'placeholder' in f ? f.placeholder : undefined}
                defaultValue={state.values?.[f.name] ?? ''}
                aria-invalid={err ? true : undefined}
                aria-describedby={err ? `${f.name}-error` : undefined}
                className={inputBase}
              />
              {err ? <p id={`${f.name}-error`} className="text-sm font-semibold">{err}</p> : null}
            </div>
          )
        })}
      </fieldset>

      <section className="space-y-2 border border-ink bg-card p-4">
        <h2 className="font-display text-lg">Order summary</h2>
        <ul className="space-y-1 text-sm">
          {lines.map((l) => <li key={l.variantId} className="flex justify-between"><span>{l.qty} × {l.name} ({sizeLabel(l.size)})</span><span>{formatPeso(l.qty * l.priceCentavos)}</span></li>)}
        </ul>
        <dl className="space-y-1 border-t border-ink pt-2 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPeso(totals.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{formatPeso(totals.shipping)}</dd></div>
          <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatPeso(totals.total)}</dd></div>
        </dl>
      </section>

      <div className="space-y-2">
        <p className="flex gap-2 text-xs font-semibold uppercase">
          {['GCash', 'Maya', 'Card', 'QR Ph'].map((m) => <span key={m} className="border border-ink bg-card px-2 py-1">{m}</span>)}
        </p>
        <button type="submit" disabled={pending} className={`${buttonPrimary} w-full`}>{pending ? 'Opening PayMongo…' : 'Pay with PayMongo'}</button>
        <p className="text-xs text-muted">Test mode: no real money is charged.</p>
      </div>
    </form>
  )
}
