import { describe, expect, it } from 'vitest'
import { parseShippingFee } from './config'

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
