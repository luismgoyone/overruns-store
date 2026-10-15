import { describe, expect, it } from 'vitest'
import { isUuid } from './queries'

describe('isUuid', () => {
  it('accepts UUIDs and rejects anything else', () => {
    expect(isUuid('3f2a9c1e-1234-4abc-8def-0123456789ab')).toBe(true)
    expect(isUuid('3f2a9c1e')).toBe(false)
    expect(isUuid("'; drop table orders; --")).toBe(false)
  })
})
