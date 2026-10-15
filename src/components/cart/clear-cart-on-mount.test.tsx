import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CART_STORAGE_KEY } from '@/lib/cart/cart'
import { CHECKOUT_MARKER_KEY } from '@/lib/checkout/marker'
import { CartProvider, useCart } from './cart-provider'
import { ClearCartOnMount } from './clear-cart-on-mount'

const line = { variantId: 'v-m', productId: 'p1', slug: 'tee', name: 'Heavyweight Tee', size: 'M', priceCentavos: 45000, image: null, qty: 1, maxQty: 2 }
const KEY = '8a1b7f1e-4d5c-4e2a-9b3c-0d1e2f3a4b5c'

function Count() {
  const { count, hydrated } = useCart()
  return <p data-testid="count">{hydrated ? count : 'loading'}</p>
}
const setup = (el: React.ReactNode) => render(<CartProvider>{el}<Count /></CartProvider>)

beforeEach(() => {
  sessionStorage.clear()
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line]))
})

describe('ClearCartOnMount', () => {
  it('clears the cart (paid order)', async () => {
    setup(<ClearCartOnMount />)
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'))
  })
  it('clears a pending order only when this tab started its checkout', async () => {
    sessionStorage.setItem(CHECKOUT_MARKER_KEY, KEY)
    setup(<ClearCartOnMount ifMarker={KEY} />)
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'))
    expect(sessionStorage.getItem(CHECKOUT_MARKER_KEY)).toBeNull()
  })
  it('keeps the cart for a pending order opened without the marker', async () => {
    sessionStorage.setItem(CHECKOUT_MARKER_KEY, 'another-key')
    setup(<ClearCartOnMount ifMarker={KEY} />)
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
    setup(<ClearCartOnMount ifMarker={null} />)
    expect(screen.getAllByTestId('count')[1]).toHaveTextContent('1')
  })
})
