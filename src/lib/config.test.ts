import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseShippingFee, siteUrl } from './config'

describe('parseShippingFee', () => {
  it('defaults to ₱150 when unset or invalid', () => {
    expect(parseShippingFee(undefined)).toBe(15000)
    expect(parseShippingFee('')).toBe(15000)
    expect(parseShippingFee('abc')).toBe(15000)
    expect(parseShippingFee('-5')).toBe(15000)
    expect(parseShippingFee('99.5')).toBe(15000)
  })
  it('accepts whole centavo amounts including zero', () => {
    expect(parseShippingFee('20000')).toBe(20000)
    expect(parseShippingFee('0')).toBe(0)
  })
})

describe('siteUrl', () => {
  afterEach(() => vi.unstubAllEnvs())
  const env = (vars: Record<string, string>) => {
    for (const k of ['NEXT_PUBLIC_SITE_URL', 'VERCEL_ENV', 'VERCEL_BRANCH_URL', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) vi.stubEnv(k, vars[k] ?? '')
  }
  it('uses the configured site URL in production', () => {
    env({ NEXT_PUBLIC_SITE_URL: 'https://shop.example.ph/', VERCEL_ENV: 'production', VERCEL_URL: 'overruns-abc.vercel.app' })
    expect(siteUrl()).toBe('https://shop.example.ph')
  })
  it('sends preview deployments back to the preview, not production', () => {
    env({ NEXT_PUBLIC_SITE_URL: 'https://shop.example.ph', VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'overruns-git-fix.vercel.app', VERCEL_URL: 'overruns-abc.vercel.app' })
    expect(siteUrl()).toBe('https://overruns-git-fix.vercel.app')
    env({ VERCEL_ENV: 'preview', VERCEL_URL: 'overruns-abc.vercel.app' })
    expect(siteUrl()).toBe('https://overruns-abc.vercel.app')
  })
  it('falls back to the production domain, then localhost', () => {
    env({ VERCEL_PROJECT_PRODUCTION_URL: 'overruns.vercel.app' })
    expect(siteUrl()).toBe('https://overruns.vercel.app')
    env({})
    expect(siteUrl()).toBe('http://localhost:3000')
  })
})
