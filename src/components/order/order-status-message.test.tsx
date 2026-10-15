import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrderStatusMessage } from './order-status-message'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const base = { oversold: false, paymentConflict: false }

describe('OrderStatusMessage', () => {
  it('confirms a paid order', () => {
    render(<OrderStatusMessage status="paid" {...base} />)
    expect(screen.getByRole('heading')).toHaveTextContent('Salamat! Your order is confirmed')
    expect(screen.queryByText(/double-checking stock/)).toBeNull()
  })
  it('softens the copy for an oversold order', () => {
    render(<OrderStatusMessage status="paid" {...base} oversold />)
    expect(screen.getByText(/We're double-checking stock for one item — we'll contact you within 24h/)).toBeInTheDocument()
  })
  it('tells a customer who paid a cancelled order that we will sort it out', () => {
    render(<OrderStatusMessage status="cancelled" {...base} paymentConflict />)
    expect(screen.getByRole('heading')).toHaveTextContent('We received your payment')
    expect(screen.getByText(/within 24h/)).toBeInTheDocument()
  })
  it('shows a plain cancelled message otherwise, and a waiting message while pending', () => {
    render(<OrderStatusMessage status="cancelled" {...base} />)
    expect(screen.getByRole('heading')).toHaveTextContent('This order was cancelled')
  })
  it('waits for PayMongo while pending', () => {
    render(<OrderStatusMessage status="pending" {...base} />)
    expect(screen.getByRole('heading')).toHaveTextContent('Almost there')
    expect(screen.getByRole('status')).toHaveTextContent('Confirming your payment')
  })
})
