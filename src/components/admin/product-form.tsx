'use client'

import Link from 'next/link'
import { Fragment, useActionState, useState } from 'react'
import { saveProduct, type ProductFormState } from '@/app/admin/(protected)/products/actions'
import { buttonInk, inputBase, inputCompact, monoLabel, textareaBase } from '@/components/ui/styles'
import { centavosToPesoInput, MAX_DESCRIPTION_LENGTH } from '@/lib/admin/product-form'
import { CATEGORIES, SIZES, sizeLabel } from '@/lib/catalog/constants'
import type { Product } from '@/lib/catalog/types'
import { panel, panelTitle } from './admin-ui'
import { ImageUploader } from './image-uploader'

const label = `block ${monoLabel}`

function Err({ e, k }: { e: Record<string, string>; k: string }) {
  return e[k] ? <p className="border-l-4 border-tag pl-2 text-left text-sm font-semibold text-ink">{e[k]}</p> : null
}

export function ProductForm({ product }: { product: Product | null }) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProduct, { status: 'idle' })
  const e = state.status === 'invalid' ? state.fieldErrors : {}
  // React 19 resets uncontrolled fields after every action, so failed saves echo the submitted values back.
  // defaultValue only applies on mount, so remount the fields whenever a new result arrives.
  const [seenState, setSeenState] = useState(state)
  const [round, setRound] = useState(0)
  if (state !== seenState) {
    setSeenState(state)
    setRound(round + 1)
  }
  const values = state.status === 'idle' ? null : state.values
  const text = (k: string, fallback: string | undefined) => values ? (values[k] ?? '') : (fallback ?? '')
  const checked = (k: string, fallback: boolean) => values ? values[k] === 'on' : fallback
  const stockFor = (size: string) => product?.variants.find((v) => v.size === size)?.stock

  return (
    <form action={action} className="max-w-5xl space-y-6">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {state.status === 'error' ? <p role="alert" className="border border-tag bg-card p-3 text-sm">{state.message}</p> : null}

      <section className={`${panel} space-y-5`}>
        <h2 className={panelTitle}>General information</h2>
        <Fragment key={`general-${round}`}>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-1.5"><span className={label}>Name</span><input name="name" defaultValue={text('name', product?.name)} className={inputBase} required /><Err e={e} k="name" /></label>
            <label className="block space-y-1.5"><span className={label}>URL slug (optional)</span><input name="slug" defaultValue={text('slug', product?.slug)} placeholder="auto from name" className={inputBase} /><Err e={e} k="slug" /></label>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className={label}>Category</span>
              <select name="category" defaultValue={text('category', product?.category)} className={inputBase}>
                <option value="" disabled>Choose…</option>
                {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
              <Err e={e} k="category" />
            </label>
            <label className="block space-y-1.5"><span className={label}>Overrun price (₱)</span><input name="price" inputMode="decimal" defaultValue={text('price', centavosToPesoInput(product?.priceCentavos ?? null))} className={inputBase} /><Err e={e} k="price" /></label>
            <label className="block space-y-1.5"><span className={label}>Retail price (₱, optional)</span><input name="retailPrice" inputMode="decimal" defaultValue={text('retailPrice', centavosToPesoInput(product?.retailPriceCentavos ?? null))} className={inputBase} /><Err e={e} k="retailPrice" /></label>
          </div>
          <label className="block space-y-1.5"><span className={label}>Description</span><textarea name="description" maxLength={MAX_DESCRIPTION_LENGTH} defaultValue={text('description', product?.description)} rows={5} className={textareaBase} /><Err e={e} k="description" /></label>
        </Fragment>
        <div key={`flags-${round}`} className="flex flex-wrap gap-x-8 gap-y-1">
          <label className={`flex h-11 items-center gap-3 ${monoLabel}`}><input type="checkbox" name="isActive" defaultChecked={checked('isActive', product?.isActive ?? true)} className="h-5 w-5 accent-ink" /> Visible in store</label>
          <label className={`flex h-11 items-center gap-3 ${monoLabel}`}><input type="checkbox" name="isFeatured" defaultChecked={checked('isFeatured', product?.isFeatured ?? false)} className="h-5 w-5 accent-ink" /> Featured on home</label>
        </div>
      </section>

      <fieldset className={`${panel} space-y-5`}>
        <legend className="sr-only">Photos (first is the cover)</legend>
        <div aria-hidden className={`${panelTitle} flex items-baseline justify-between gap-4`}>Photos <span className="font-mono text-[11px] font-normal uppercase tracking-[0.15em] text-muted">First is the cover</span></div>
        <ImageUploader initial={product?.images ?? []} />
        <Err e={e} k="images" />
      </fieldset>

      <fieldset key={`stock-${round}`} className={`${panel} space-y-5`}>
        <legend className="sr-only">Stock per size (leave blank if the size doesn&apos;t exist)</legend>
        <div aria-hidden className={`${panelTitle} flex flex-wrap items-baseline justify-between gap-x-4`}>Stock per size <span className="font-mono text-[11px] font-normal uppercase tracking-[0.15em] text-muted">Leave blank if the size doesn&apos;t exist</span></div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {SIZES.map((s) => (
            <label key={s} className="block space-y-2 border border-hairline bg-paper p-2 text-center font-mono text-[11px] font-bold uppercase tracking-[0.1em]">
              {sizeLabel(s)}
              <input name={`stock_${s}`} inputMode="numeric" defaultValue={text(`stock_${s}`, stockFor(s)?.toString())} className={inputCompact} />
              {/* Saves apply the difference to the live stock, so sales made while this form was open aren't lost. */}
              {stockFor(s) !== undefined ? <input type="hidden" name={`stock_orig_${s}`} value={stockFor(s)} /> : null}
              <Err e={e} k={`stock_${s}`} />
            </label>
          ))}
        </div>
        <Err e={e} k="stock" />
      </fieldset>

      <div className="flex items-center justify-end gap-4 border-t border-hairline pt-6">
        <Link href="/admin/products" className="inline-flex h-12 items-center px-3 font-mono text-sm font-bold uppercase tracking-[0.15em] underline-offset-4 hover:underline">Cancel</Link>
        <button type="submit" disabled={pending} className={buttonInk}>{pending ? 'Saving…' : 'Save product'}</button>
      </div>
    </form>
  )
}
