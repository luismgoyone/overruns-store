'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { buildCheckoutDeps } from '@/lib/checkout/deps'
import { cartPayloadSchema, checkoutFormSchema } from '@/lib/checkout/schema'
import { startCheckoutCore } from '@/lib/checkout/start-checkout'
import type { CartProblem } from '@/lib/checkout/types'

const FIELDS = ['name', 'phone', 'email', 'street', 'barangay', 'city', 'province', 'zip'] as const

export type CheckoutActionState =
  | { status: 'idle'; values?: Record<string, string> }
  | { status: 'invalid'; fieldErrors: Partial<Record<(typeof FIELDS)[number], string[]>>; values: Record<string, string> }
  | { status: 'cart_problems'; problems: CartProblem[]; values: Record<string, string> }
  | { status: 'error'; message: string; values: Record<string, string> }

export async function startCheckout(_prev: CheckoutActionState, formData: FormData): Promise<CheckoutActionState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? '')]))
  const form = checkoutFormSchema.safeParse(values)
  if (!form.success) return { status: 'invalid', fieldErrors: z.flattenError(form.error).fieldErrors, values }

  let cartJson: unknown = null
  try {
    cartJson = JSON.parse(String(formData.get('cart') ?? ''))
  } catch {}
  const cart = cartPayloadSchema.safeParse(cartJson)
  if (!cart.success) return { status: 'error', message: 'Your cart is empty or out of date. Please go back to your cart.', values }

  const secretKey = process.env.PAYMONGO_SECRET_KEY
  if (!secretKey) return { status: 'error', message: 'Payments are not configured yet (PAYMONGO_SECRET_KEY is missing).', values }

  const result = await startCheckoutCore(form.data, cart.data, buildCheckoutDeps(secretKey))
  if (result.kind === 'redirect') redirect(result.url)
  return result.kind === 'cart_problems' ? { status: 'cart_problems', problems: result.problems, values } : { status: 'error', message: result.message, values }
}
