import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { eyebrow } from '@/components/ui/styles'

export const metadata: Metadata = { title: 'Checkout' }

export default function CheckoutPage() {
  return (
    <div className="space-y-8 px-4 pt-8 sm:px-8 lg:pt-12">
      <div className="space-y-1 border-b border-hairline pb-5">
        <p className={eyebrow}>Secure checkout · PayMongo</p>
        <h1 className="font-display text-3xl lg:text-5xl">Checkout</h1>
      </div>
      <CheckoutForm />
    </div>
  )
}
