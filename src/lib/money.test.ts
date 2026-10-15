import { describe, expect, it } from 'vitest'
import { formatPeso } from './money'

describe('formatPeso', () => {
  it('formats whole pesos without decimals', () => {
    expect(formatPeso(189900)).toBe('₱1,899')
    expect(formatPeso(0)).toBe('₱0')
  })
  it('shows centavos when present', () => {
    expect(formatPeso(15050)).toBe('₱150.50')
  })
  it('rejects non-integer centavos', () => {
    expect(() => formatPeso(1.5)).toThrow(/integer/)
  })
})
