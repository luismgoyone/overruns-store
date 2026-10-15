import { afterEach, describe, expect, it, vi } from 'vitest'

const build = vi.hoisted(() => ({ buildCheckoutDeps: vi.fn() }))
const core = vi.hoisted(() => ({ startCheckoutCore: vi.fn() }))
vi.mock('@/lib/checkout/deps', () => build)
vi.mock('@/lib/checkout/start-checkout', () => core)
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw Object.assign(new Error('NEXT_REDIRECT'), { url }) } }))

const { startCheckout } = await import('./actions')

const KEY = '8a1b7f1e-4d5c-4e2a-9b3c-0d1e2f3a4b5c'
function formData(over: Record<string, string> = {}) {
  const f = new FormData()
  const values = {
    name: 'Juan Dela Cruz', phone: '0917 123 4567', email: 'juan@example.com', street: '12 Mabini St', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '1210',
    cart: JSON.stringify([{ variantId: '00000000-0000-4000-8000-000000000001', qty: 1, priceCentavos: 45000 }]),
    idempotency_key: KEY,
    ...over,
  }
  for (const [k, v] of Object.entries(values)) f.set(k, v)
  return f
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  build.buildCheckoutDeps.mockReset()
  core.startCheckoutCore.mockReset()
})

describe('startCheckout action', () => {
  it('returns a friendly error (not a crash) when the server is missing its database key', async () => {
    vi.stubEnv('PAYMONGO_SECRET_KEY', 'sk_test_x')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    build.buildCheckoutDeps.mockImplementation(() => { throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set') })
    const r = await startCheckout({ status: 'idle' }, formData())
    expect(r).toMatchObject({ status: 'error', message: expect.stringMatching(/try again/i) })
  })
  it('passes the idempotency key through to checkout', async () => {
    vi.stubEnv('PAYMONGO_SECRET_KEY', 'sk_test_x')
    build.buildCheckoutDeps.mockReturnValue({})
    core.startCheckoutCore.mockResolvedValue({ kind: 'redirect', url: 'https://checkout.paymongo.com/cs_1' })
    await expect(startCheckout({ status: 'idle' }, formData())).rejects.toMatchObject({ url: 'https://checkout.paymongo.com/cs_1' })
    expect(core.startCheckoutCore).toHaveBeenCalledWith(expect.anything(), expect.anything(), {}, KEY)
  })
  it('rejects a malformed idempotency key', async () => {
    vi.stubEnv('PAYMONGO_SECRET_KEY', 'sk_test_x')
    const r = await startCheckout({ status: 'idle' }, formData({ idempotency_key: 'nope' }))
    expect(r).toMatchObject({ status: 'error', message: expect.stringMatching(/reload/i) })
    expect(core.startCheckoutCore).not.toHaveBeenCalled()
  })
})
