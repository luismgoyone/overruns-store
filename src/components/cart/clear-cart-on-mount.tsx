'use client'

import { useEffect } from 'react'
import { takeCheckoutMarker } from '@/lib/checkout/marker'
import { useCart } from './cart-provider'

/**
 * Empties the cart once it has hydrated. With `ifMarker`, only when this tab's last checkout used that
 * idempotency key (i.e. the shopper just came back from this order's PayMongo page).
 */
export function ClearCartOnMount({ ifMarker }: { ifMarker?: string | null }) {
  const { hydrated, dispatch } = useCart()
  // Wait for hydration, or the stored cart would be restored right after clearing.
  useEffect(() => {
    if (!hydrated) return
    if (ifMarker !== undefined && !takeCheckoutMarker(ifMarker)) return
    dispatch({ type: 'clear' })
  }, [hydrated, dispatch, ifMarker])
  return null
}
