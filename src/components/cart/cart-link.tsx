'use client'

import Link from 'next/link'
import { useCart } from './cart-provider'

export function CartLink() {
  const { count, hydrated } = useCart()
  const shown = hydrated ? count : 0
  return (
    <Link href="/cart" aria-label={`Cart, ${shown} ${shown === 1 ? 'item' : 'items'}`} className="flex h-11 items-center gap-2 px-3 text-sm font-semibold uppercase">
      Cart
      <span className="inline-flex h-6 min-w-6 items-center justify-center border border-ink bg-tag px-1 text-xs font-bold text-ink">{shown}</span>
    </Link>
  )
}
