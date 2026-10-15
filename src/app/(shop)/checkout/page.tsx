import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/checkout/checkout-form'

export const metadata: Metadata = { title: 'Checkout' }

export default function CheckoutPage() {
  return (
    <div className="max-w-xl space-y-6 px-4 py-6">
      <h1 className="font-display text-2xl">Checkout</h1>
      <CheckoutForm />
    </div>
  )
}
