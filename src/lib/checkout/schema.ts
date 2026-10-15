import { z } from 'zod'
import { MAX_QTY_PER_LINE } from '@/lib/cart/cart'

const PH_MOBILE = /^(?:\+?63|0)(9\d{9})$/
const text = (label: string) => z.string().trim().min(2, `Enter your ${label}`).max(200)

export const addressSchema = z.object({
  street: text('street address'),
  barangay: text('barangay'),
  city: text('city or municipality'),
  province: text('province'),
  zip: z.string().trim().regex(/^\d{4}$/, 'Philippine ZIP codes have 4 digits'),
})
export type Address = z.infer<typeof addressSchema>

export const checkoutFormSchema = addressSchema.extend({
  name: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(PH_MOBILE, 'Enter a PH mobile number like 0917 123 4567'))
    .transform((s) => `+63${s.match(PH_MOBILE)![1]}`),
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
})
export type CheckoutForm = z.infer<typeof checkoutFormSchema>

export const cartPayloadSchema = z
  .array(z.object({ variantId: z.uuid(), qty: z.number().int().min(1).max(MAX_QTY_PER_LINE), priceCentavos: z.number().int().nonnegative() }))
  .min(1)
  .max(50)
export type CartPayloadLine = z.infer<typeof cartPayloadSchema>[number]
