import { afterEach, describe, expect, it, vi } from 'vitest'
import { productImageUrl } from './images'

afterEach(() => vi.unstubAllEnvs())

describe('productImageUrl', () => {
  it('passes absolute URLs through', () => {
    expect(productImageUrl('https://picsum.photos/seed/x/800/800')).toBe('https://picsum.photos/seed/x/800/800')
  })
  it('builds a public storage URL for a storage path', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    expect(productImageUrl('products/a b.jpg')).toBe('https://abc.supabase.co/storage/v1/object/public/product-images/products/a%20b.jpg')
  })
})
