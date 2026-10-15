import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CartProvider, useCart } from '@/components/cart/cart-provider'
import type { Product } from '@/lib/catalog/types'
import { AddToCart } from './add-to-cart'

const product: Product = {
  id: 'p1', slug: 'oxford', name: 'Oxford', description: '', category: 'tops',
  priceCentavos: 69000, retailPriceCentavos: 189900, images: [], isActive: true, isFeatured: false,
  createdAt: '2026-10-01T00:00:00Z',
  variants: [{ id: 'v-s', size: 'S', stock: 0 }, { id: 'v-m', size: 'M', stock: 2 }],
}

function Count() {
  const { count, hydrated } = useCart()
  return <output aria-label="count">{hydrated ? count : '-'}</output>
}

const setup = (p = product) => render(<CartProvider><AddToCart product={p} /><Count /></CartProvider>)

describe('AddToCart', () => {
  it('cannot add a sold-out size', async () => {
    setup()
    const sold = screen.getByRole('button', { name: /S \(sold out\)/ })
    expect(sold).toBeDisabled()
    await userEvent.click(sold)
    expect(screen.getByRole('button', { name: 'Select a size' })).toBeDisabled()
    expect(screen.getByLabelText('count')).toHaveTextContent('0')
  })
  it('adds an in-stock size and shows the low-stock note', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'M' }))
    expect(screen.getByText('Only 2 left in M')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))
    expect(screen.getByLabelText('count')).toHaveTextContent('1')
    expect(screen.getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart')
  })
  it('shows a disabled Sold out button when nothing is in stock', () => {
    setup({ ...product, variants: [{ id: 'v-s', size: 'S', stock: 0 }] })
    expect(screen.getByRole('button', { name: 'Sold out' })).toBeDisabled()
  })
})
