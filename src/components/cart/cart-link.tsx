'use client'

import Link from 'next/link'
import { useCart } from './cart-provider'

export function CartLink() {
  const { count, hydrated } = useCart()
  const shown = hydrated ? count : 0
  return (
    <Link href="/cart" aria-label={`Cart, ${shown} ${shown === 1 ? 'item' : 'items'}`} className="relative flex h-11 w-11 items-center justify-center">
      <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
        <path d="M5 8h14l-1 13H6L5 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      {shown > 0 ? (
        <span className="absolute right-0.5 top-0.5 inline-flex h-5 min-w-5 items-center justify-center bg-tag px-1 font-mono text-[11px] font-bold text-ink">{shown}</span>
      ) : null}
    </Link>
  )
}
