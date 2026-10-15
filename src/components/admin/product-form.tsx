'use client'

import { Fragment, useActionState, useState } from 'react'
import { saveProduct, type ProductFormState } from '@/app/admin/(protected)/products/actions'
import { buttonPrimary, inputBase } from '@/components/ui/styles'
import { centavosToPesoInput, MAX_DESCRIPTION_LENGTH } from '@/lib/admin/product-form'
import { CATEGORIES, SIZES, sizeLabel } from '@/lib/catalog/constants'
import type { Product } from '@/lib/catalog/types'
import { ImageUploader } from './image-uploader'

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
    <form action={action} className="max-w-2xl space-y-6">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {state.status === 'error' ? <p role="alert" className="border border-tag bg-card p-3 text-sm">{state.message}</p> : null}

      <Fragment key={`fields-${round}`}>
        <label className="block space-y-1"><span className="text-sm font-semibold">Name</span><input name="name" defaultValue={text('name', product?.name)} className={inputBase} required /><Err e={e} k="name" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">URL slug (optional)</span><input name="slug" defaultValue={text('slug', product?.slug)} placeholder="auto from name" className={inputBase} /><Err e={e} k="slug" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Description</span><textarea name="description" maxLength={MAX_DESCRIPTION_LENGTH} defaultValue={text('description', product?.description)} rows={4} className={`${inputBase} h-auto py-2`} /><Err e={e} k="description" /></label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Category</span>
          <select name="category" defaultValue={text('category', product?.category)} className={inputBase}>
            <option value="" disabled>Choose…</option>
            {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
          <Err e={e} k="category" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1"><span className="text-sm font-semibold">Overrun price (₱)</span><input name="price" inputMode="decimal" defaultValue={text('price', centavosToPesoInput(product?.priceCentavos ?? null))} className={inputBase} /><Err e={e} k="price" /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold">Retail price (₱, optional)</span><input name="retailPrice" inputMode="decimal" defaultValue={text('retailPrice', centavosToPesoInput(product?.retailPriceCentavos ?? null))} className={inputBase} /><Err e={e} k="retailPrice" /></label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Stock per size (leave blank if the size doesn&apos;t exist)</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {SIZES.map((s) => (
              <label key={s} className="space-y-1 text-center text-xs font-semibold">
                {sizeLabel(s)}
                <input name={`stock_${s}`} inputMode="numeric" defaultValue={text(`stock_${s}`, stockFor(s)?.toString())} className={`${inputBase} text-center`} />
                <Err e={e} k={`stock_${s}`} />
              </label>
            ))}
          </div>
          <Err e={e} k="stock" />
        </fieldset>
      </Fragment>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Photos (first is the cover)</legend>
        <ImageUploader initial={product?.images ?? []} />
        <Err e={e} k="images" />
      </fieldset>

      <div key={`flags-${round}`} className="flex gap-6">
        <label className="flex h-11 items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={checked('isActive', product?.isActive ?? true)} className="h-5 w-5" /> Visible in store</label>
        <label className="flex h-11 items-center gap-2"><input type="checkbox" name="isFeatured" defaultChecked={checked('isFeatured', product?.isFeatured ?? false)} className="h-5 w-5" /> Featured on home</label>
      </div>

      <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? 'Saving…' : 'Save product'}</button>
    </form>
  )
}
