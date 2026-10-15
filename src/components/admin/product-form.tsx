'use client'

import { useActionState } from 'react'
import { saveProduct, type ProductFormState } from '@/app/admin/(protected)/products/actions'
import { buttonPrimary, inputBase } from '@/components/ui/styles'
import { centavosToPesoInput } from '@/lib/admin/product-form'
import { CATEGORIES, SIZES, sizeLabel } from '@/lib/catalog/constants'
import type { Product } from '@/lib/catalog/types'
import { ImageUploader } from './image-uploader'

function Err({ e, k }: { e: Record<string, string>; k: string }) {
  return e[k] ? <p className="text-sm font-semibold text-tag">{e[k]}</p> : null
}

export function ProductForm({ product }: { product: Product | null }) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProduct, { status: 'idle' })
  const e = state.status === 'invalid' ? state.fieldErrors : {}
  const stockFor = (size: string) => product?.variants.find((v) => v.size === size)?.stock

  return (
    <form action={action} className="max-w-2xl space-y-6">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {state.status === 'error' ? <p role="alert" className="border border-tag bg-card p-3 text-sm">{state.message}</p> : null}

      <label className="block space-y-1"><span className="text-sm font-semibold">Name</span><input name="name" defaultValue={product?.name} className={inputBase} required /><Err e={e} k="name" /></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">URL slug (optional)</span><input name="slug" defaultValue={product?.slug} placeholder="auto from name" className={inputBase} /><Err e={e} k="slug" /></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">Description</span><textarea name="description" defaultValue={product?.description} rows={4} className={`${inputBase} h-auto py-2`} /></label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Category</span>
        <select name="category" defaultValue={product?.category ?? ''} className={inputBase}>
          <option value="" disabled>Choose…</option>
          {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </select>
        <Err e={e} k="category" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block space-y-1"><span className="text-sm font-semibold">Overrun price (₱)</span><input name="price" inputMode="decimal" defaultValue={centavosToPesoInput(product?.priceCentavos ?? null)} className={inputBase} /><Err e={e} k="price" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Retail price (₱, optional)</span><input name="retailPrice" inputMode="decimal" defaultValue={centavosToPesoInput(product?.retailPriceCentavos ?? null)} className={inputBase} /><Err e={e} k="retailPrice" /></label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Stock per size (leave blank if the size doesn&apos;t exist)</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {SIZES.map((s) => (
            <label key={s} className="space-y-1 text-center text-xs font-semibold">
              {sizeLabel(s)}
              <input name={`stock_${s}`} inputMode="numeric" defaultValue={stockFor(s) ?? ''} className={`${inputBase} text-center`} />
              <Err e={e} k={`stock_${s}`} />
            </label>
          ))}
        </div>
        <Err e={e} k="stock" />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Photos (first is the cover)</legend>
        <ImageUploader initial={product?.images ?? []} />
        <Err e={e} k="images" />
      </fieldset>

      <div className="flex gap-6">
        <label className="flex h-11 items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} className="h-5 w-5" /> Visible in store</label>
        <label className="flex h-11 items-center gap-2"><input type="checkbox" name="isFeatured" defaultChecked={product?.isFeatured ?? false} className="h-5 w-5" /> Featured on home</label>
      </div>

      <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? 'Saving…' : 'Save product'}</button>
    </form>
  )
}
