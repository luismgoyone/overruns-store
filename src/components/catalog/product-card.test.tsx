import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Product } from '@/lib/catalog/types'
import { ProductCard } from './product-card'

const base: Product = {
  id: 'p1', slug: 'coach-jacket', name: 'Coach Jacket', description: '', category: 'outerwear',
  priceCentavos: 149000, retailPriceCentavos: 429900, images: ['https://picsum.photos/seed/x/800/800'],
  isActive: true, isFeatured: false, createdAt: '2026-10-01T00:00:00Z',
  variants: [{ id: 'v1', size: 'M', stock: 2 }, { id: 'v2', size: 'L', stock: 1 }],
}

describe('ProductCard', () => {
  it('links to the product and shows low stock', () => {
    render(<ProductCard product={base} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/product/coach-jacket')
    expect(screen.getByText('Only 3 left')).toBeInTheDocument()
  })
  it('shows a sold-out overlay when no size has stock', () => {
    render(<ProductCard product={{ ...base, variants: [{ id: 'v1', size: 'M', stock: 0 }] }} />)
    expect(screen.getByText('Sold out')).toBeInTheDocument()
    expect(screen.queryByText(/Only \d left/)).toBeNull()
  })
})
