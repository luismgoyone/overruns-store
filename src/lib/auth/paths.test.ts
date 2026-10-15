import { describe, expect, it } from 'vitest'
import { isProtectedAdminPath, safeNextPath } from './paths'

describe('isProtectedAdminPath', () => {
  it('protects /admin and everything under it except login', () => {
    expect(isProtectedAdminPath('/admin')).toBe(true)
    expect(isProtectedAdminPath('/admin/orders')).toBe(true)
    expect(isProtectedAdminPath('/admin/login')).toBe(false)
    expect(isProtectedAdminPath('/administrator')).toBe(false)
    expect(isProtectedAdminPath('/shop')).toBe(false)
  })
})

describe('safeNextPath', () => {
  it('only allows redirects back into /admin', () => {
    expect(safeNextPath('/admin/products')).toBe('/admin/products')
    expect(safeNextPath('https://evil.test')).toBe('/admin')
    expect(safeNextPath('//evil.test/admin')).toBe('/admin')
    expect(safeNextPath('/shop')).toBe('/admin')
    expect(safeNextPath(null)).toBe('/admin')
  })
})
