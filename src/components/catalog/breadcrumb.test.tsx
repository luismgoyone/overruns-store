import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackButton } from './back-button'
import { Breadcrumb } from './breadcrumb'

const back = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ back, push }) }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Breadcrumb', () => {
  it('links each level and marks the current page', () => {
    render(<Breadcrumb items={[{ label: 'Shop', href: '/shop' }, { label: 'Bottoms', href: '/shop?category=bottoms' }, { label: 'Track Pants' }]} />)
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop')
    expect(screen.getByRole('link', { name: 'Bottoms' })).toHaveAttribute('href', '/shop?category=bottoms')
    expect(screen.getByText('Track Pants')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Track Pants' })).not.toBeInTheDocument()
  })
})

describe('BackButton', () => {
  it('goes back in history when the visitor came from this store', async () => {
    vi.stubGlobal('history', { length: 3 })
    Object.defineProperty(document, 'referrer', { value: `${window.location.origin}/shop`, configurable: true })
    render(<BackButton fallbackHref="/shop" />)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(back).toHaveBeenCalledOnce()
    expect(push).not.toHaveBeenCalled()
  })

  it('goes to the fallback when the visitor landed here directly (e.g. from Instagram)', async () => {
    Object.defineProperty(document, 'referrer', { value: 'https://l.instagram.com/', configurable: true })
    render(<BackButton fallbackHref="/shop?category=bottoms" />)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(push).toHaveBeenCalledWith('/shop?category=bottoms')
    expect(back).not.toHaveBeenCalled()
  })
})
