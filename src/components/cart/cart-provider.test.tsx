import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CART_STORAGE_KEY } from '@/lib/cart/cart'
import { CartProvider, useCart } from './cart-provider'

const tee = { variantId: 'v-m', productId: 'p1', slug: 'tee', name: 'Tee', size: 'M' as const, priceCentavos: 50000, image: null, maxQty: 3 }

function Probe() {
  const { count, hydrated, dispatch } = useCart()
  return (
    <>
      <span data-testid="count">{hydrated ? count : 'loading'}</span>
      <button onClick={() => dispatch({ type: 'add', line: tee })}>add</button>
    </>
  )
}

const renderCart = () => render(<CartProvider><Probe /></CartProvider>)

describe('CartProvider', () => {
  it('restores the cart from localStorage', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ ...tee, qty: 2 }]))
    renderCart()
    expect(await screen.findByText('2')).toBeInTheDocument()
  })
  it('treats corrupted storage as an empty cart', async () => {
    localStorage.setItem(CART_STORAGE_KEY, '{oops')
    renderCart()
    expect(await screen.findByText('0')).toBeInTheDocument()
  })
  it('persists changes', async () => {
    renderCart()
    await screen.findByText('0')
    await userEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toHaveLength(1)
  })
})
