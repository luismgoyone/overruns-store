import { describe, expect, it } from 'vitest'
import { formatManilaDate, formatOrderNumber } from './format'

describe('order formatting', () => {
  it('uses the first 8 chars of the id, upper-cased', () => {
    expect(formatOrderNumber('3f2a9c1e-0000-4000-8000-000000000000')).toBe('3F2A9C1E')
  })
  it('formats dates in Manila time', () => {
    expect(formatManilaDate('2026-10-15T16:30:00Z')).toBe('Oct 16, 2026, 12:30 AM')
  })
})
