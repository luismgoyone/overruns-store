'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { buildCheckoutDeps } from '@/lib/checkout/deps'
import { cartPayloadSchema, checkoutFormSchema, idempotencyKeySchema } from '@/lib/checkout/schema'
import { startCheckoutCore, type StartCheckoutResult } from '@/lib/checkout/start-checkout'
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

  const key = idempotencyKeySchema.safeParse(formData.get('idempotency_key'))
  if (!key.success) return { status: 'error', message: 'This checkout page is out of date. Please reload it and try again.', values }

  const secretKey = process.env.PAYMONGO_SECRET_KEY
  if (!secretKey) {
    console.error('[checkout] PAYMONGO_SECRET_KEY is not set')
    return { status: 'error', message: "Online payment isn't available right now. Please try again later.", values }
  }

  let result: StartCheckoutResult
  try {
    // Inside the try: a missing server key (e.g. SUPABASE_SERVICE_ROLE_KEY) becomes a friendly message, not a crash.
    result = await startCheckoutCore(form.data, cart.data, buildCheckoutDeps(secretKey), key.data)
  } catch (err) {
    console.error('[checkout] unexpected failure', err)
    return { status: 'error', message: 'The store is having trouble right now. Please try again in a minute.', values }
  }
  if (result.kind === 'redirect') redirect(result.url)
  return result.kind === 'cart_problems' ? { status: 'cart_problems', problems: result.problems, values } : { status: 'error', message: result.message, values }
}
