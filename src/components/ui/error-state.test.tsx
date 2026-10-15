import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorState } from './error-state'

afterEach(() => vi.restoreAllMocks())

describe('ErrorState', () => {
  it('explains the store may be waking up and retries on click', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const retry = vi.fn()
    render(<ErrorState error={Object.assign(new Error('db timeout'), { digest: 'abc123' })} retry={retry} />)
    expect(screen.getByRole('heading')).toHaveTextContent('Something went wrong')
    expect(screen.getByText(/waking up/i)).toBeInTheDocument()
    expect(screen.getByText(/abc123/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalled()
  })
})
