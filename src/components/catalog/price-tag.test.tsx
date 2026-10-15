import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PriceTag } from './price-tag'

describe('PriceTag', () => {
  it('strikes through the retail price and bolds the overrun price', () => {
    const { container } = render(<PriceTag price={69000} retail={189900} />)
    expect(container.querySelector('s')).toHaveTextContent('₱1,899')
    expect(container).toHaveTextContent('Overrun price ₱690')
  })
  it('omits the strike-through without a retail price', () => {
    const { container } = render(<PriceTag price={69000} retail={null} />)
    expect(container.querySelector('s')).toBeNull()
  })
})
