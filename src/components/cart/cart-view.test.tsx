import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CART_STORAGE_KEY } from '@/lib/cart/cart'
import { CartProvider } from './cart-provider'
import { CartView } from './cart-view'

const line = { variantId: 'v-m', productId: 'p1', slug: 'tee', name: 'Heavyweight Tee', size: 'M', priceCentavos: 45000, image: null, qty: 1, maxQty: 2 }
const setup = (cancelled = false) => render(<CartProvider><CartView cancelled={cancelled} /></CartProvider>)

describe('CartView', () => {
  it('shows an empty state', async () => {
    setup()
    expect(await screen.findByText('Your cart is empty.')).toBeInTheDocument()
  })
  it('shows subtotal, flat shipping and total, and caps quantity at stock', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line]))
    setup()
    expect(await screen.findByText('Heavyweight Tee')).toBeInTheDocument()
    expect(screen.getByTestId('subtotal')).toHaveTextContent('₱450')
    expect(screen.getByTestId('shipping')).toHaveTextContent('₱150')
    expect(screen.getByTestId('total')).toHaveTextContent('₱600')
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity of Heavyweight Tee, size M' }))
    expect(screen.getByTestId('total')).toHaveTextContent('₱1,050')
    expect(screen.getByRole('button', { name: 'Increase quantity of Heavyweight Tee, size M' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/checkout')
  })
  it('keeps the cart and explains when payment was cancelled', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line]))
    setup(true)
    expect(await screen.findByRole('status')).toHaveTextContent('Payment was cancelled')
    expect(screen.getByText('Heavyweight Tee')).toBeInTheDocument()
  })
})
