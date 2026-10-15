'use client'

import { useEffect } from 'react'
import { useCart } from './cart-provider'

export function ClearCartOnMount() {
  const { hydrated, dispatch } = useCart()
  // Wait for hydration, or the stored cart would be restored right after clearing.
  useEffect(() => {
    if (hydrated) dispatch({ type: 'clear' })
  }, [hydrated, dispatch])
  return null
}
