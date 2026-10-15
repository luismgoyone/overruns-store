import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CART_STORAGE_KEY } from '@/lib/cart/cart'
import { CartProvider } from '@/components/cart/cart-provider'
import { CHECKOUT_MARKER_KEY } from '@/lib/checkout/marker'
import { CheckoutForm } from './checkout-form'

const startCheckout = vi.fn()
vi.mock('@/app/(shop)/checkout/actions', () => ({ startCheckout: (...args: unknown[]) => startCheckout(...args) }))

const line = { variantId: 'v-m', productId: 'p1', slug: 'tee', name: 'Heavyweight Tee', size: 'M', priceCentavos: 45000, image: null, qty: 1, maxQty: 2 }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const keyInput = () => document.querySelector<HTMLInputElement>('[name="idempotency_key"]')!

beforeEach(() => {
  startCheckout.mockReset()
  sessionStorage.clear()
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line]))
})

describe('CheckoutForm idempotency key', () => {
  it('sends one key per form instance and marks the tab before leaving for PayMongo', async () => {
    startCheckout.mockResolvedValue({ status: 'error', message: 'PayMongo down', values: {} })
    render(<CartProvider><CheckoutForm /></CartProvider>)
    await screen.findByRole('button', { name: 'Pay with PayMongo' })
    const key = keyInput().value
    expect(key).toMatch(UUID)

    fireEvent.click(screen.getByRole('button', { name: 'Pay with PayMongo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('PayMongo down')
    expect((startCheckout.mock.calls[0][1] as FormData).get('idempotency_key')).toBe(key)
    expect(sessionStorage.getItem(CHECKOUT_MARKER_KEY)).toBe(key)

    // A finished (failed) attempt gets a fresh key, so the retry is a new order.
    await waitFor(() => expect(keyInput().value).not.toBe(key))
    expect(keyInput().value).toMatch(UUID)
  })
})
