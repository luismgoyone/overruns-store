'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/components/cart/cart-provider'
import { buttonPrimary } from '@/components/ui/styles'
import { sizeStockNote } from '@/lib/catalog/stock'
import type { Product } from '@/lib/catalog/types'
import { SizePicker } from './size-picker'

export function AddToCart({ product }: { product: Product }) {
  const { dispatch } = useCart()
  const inStock = product.variants.filter((v) => v.stock > 0)
  const onlyOne = product.variants.length === 1 && inStock.length === 1
  const [variantId, setVariantId] = useState<string | null>(onlyOne ? inStock[0].id : null)
  const [added, setAdded] = useState(false)
  const variant = product.variants.find((v) => v.id === variantId && v.stock > 0) ?? null
  const note = variant ? sizeStockNote(variant) : null

  function add() {
    if (!variant) return
    dispatch({
      type: 'add',
      line: {
        variantId: variant.id, productId: product.id, slug: product.slug, name: product.name, size: variant.size,
        priceCentavos: product.priceCentavos, image: product.images[0] ?? null, maxQty: variant.stock,
      },
    })
    setAdded(true)
  }

  return (
    <div className="space-y-4">
      <SizePicker variants={product.variants} selected={variantId} onSelect={(id) => { setVariantId(id); setAdded(false) }} />
      {note ? <p className="text-sm font-semibold">{note}</p> : null}
      <div data-sticky-cta className="fixed inset-x-0 bottom-0 z-20 space-y-2 border-t border-ink bg-paper p-4 sm:static sm:border-0 sm:p-0">
        {inStock.length === 0 ? (
          <button type="button" disabled className={`${buttonPrimary} w-full`}>Sold out</button>
        ) : (
          <button type="button" onClick={add} disabled={!variant} className={`${buttonPrimary} w-full`}>
            {variant ? 'Add to cart' : 'Select a size'}
          </button>
        )}
        {added ? (
          <p role="status" className="text-center text-sm">
            Added to cart. <Link href="/cart" className="font-semibold underline">View cart</Link>
          </p>
        ) : null}
      </div>
    </div>
  )
}
