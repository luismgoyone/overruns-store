import { describe, expect, it } from 'vitest'
import { cartPayloadSchema, checkoutFormSchema, idempotencyKeySchema } from './schema'

const valid = { name: 'Juan Dela Cruz', phone: '0917 123 4567', email: 'juan@example.com', street: '12 Mabini St', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '1210' }

describe('checkoutFormSchema', () => {
  it('normalizes PH mobile numbers to +63 format', () => {
    expect(checkoutFormSchema.parse(valid).phone).toBe('+639171234567')
    expect(checkoutFormSchema.parse({ ...valid, phone: '+63 917-123-4567' }).phone).toBe('+639171234567')
    expect(checkoutFormSchema.parse({ ...valid, phone: '(0917) 123.4567' }).phone).toBe('+639171234567')
  })
  it('rejects bad phone, email and ZIP with readable messages', () => {
    const r = checkoutFormSchema.safeParse({ ...valid, phone: '12345', email: 'nope', zip: '12' })
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map((i) => i.path[0])
    expect(paths).toEqual(expect.arrayContaining(['phone', 'email', 'zip']))
  })
})

describe('cartPayloadSchema', () => {
  it('rejects an empty cart and silly quantities', () => {
    expect(cartPayloadSchema.safeParse([]).success).toBe(false)
    expect(cartPayloadSchema.safeParse([{ variantId: '00000000-0000-4000-8000-000000000001', qty: 0, priceCentavos: 100 }]).success).toBe(false)
    expect(cartPayloadSchema.safeParse([{ variantId: 'x', qty: 1, priceCentavos: 100 }]).success).toBe(false)
  })
})

describe('idempotencyKeySchema', () => {
  it('accepts a UUID, treats a missing key as null, and rejects anything else', () => {
    expect(idempotencyKeySchema.parse('8a1b7f1e-4d5c-4e2a-9b3c-0d1e2f3a4b5c')).toBe('8a1b7f1e-4d5c-4e2a-9b3c-0d1e2f3a4b5c')
    expect(idempotencyKeySchema.parse(null)).toBeNull()
    expect(idempotencyKeySchema.parse('')).toBeNull()
    expect(idempotencyKeySchema.safeParse('not-a-uuid').success).toBe(false)
    expect(idempotencyKeySchema.safeParse('x'.repeat(500)).success).toBe(false)
  })
})
