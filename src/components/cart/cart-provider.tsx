'use client'

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { CART_STORAGE_KEY, cartCount, cartReducer, cartSubtotal, EMPTY_CART, parseStoredCart, type CartAction, type CartLine } from '@/lib/cart/cart'

type CartContextValue = {
  lines: CartLine[]
  count: number
  subtotal: number
  hydrated: boolean
  dispatch: (action: CartAction) => void
}

const CartContext = createContext<CartContextValue | null>(null)

function readStorage(): string | null {
  try {
    return localStorage.getItem(CART_STORAGE_KEY)
  } catch {
    return null // private mode or blocked storage
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART)

  useEffect(() => {
    dispatch({ type: 'hydrate', lines: parseStoredCart(readStorage()) })
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) dispatch({ type: 'hydrate', lines: parseStoredCart(e.newValue) })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!state.hydrated) return
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.lines))
    } catch {
      // Storage unavailable; the cart still works for this page view.
    }
  }, [state])

  const value = useMemo<CartContextValue>(
    () => ({ lines: state.lines, count: cartCount(state.lines), subtotal: cartSubtotal(state.lines), hydrated: state.hydrated, dispatch }),
    [state],
  )
  return <CartContext value={value}>{children}</CartContext>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
