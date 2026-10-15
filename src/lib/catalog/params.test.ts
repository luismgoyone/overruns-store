import { describe, expect, it } from 'vitest'
import { parseShopParams } from './params'

describe('parseShopParams', () => {
  it('defaults to all products, newest first', () => {
    expect(parseShopParams({})).toEqual({ category: null, size: null, sort: 'newest' })
  })
  it('accepts known category, size (any case) and sort', () => {
    expect(parseShopParams({ category: 'tops', size: 'xl', sort: 'price-asc' })).toEqual({ category: 'tops', size: 'XL', sort: 'price-asc' })
  })
  it('ignores unknown or empty values and uses the first of repeated keys', () => {
    expect(parseShopParams({ category: 'shoes', size: '', sort: 'random' })).toEqual({ category: null, size: null, sort: 'newest' })
    expect(parseShopParams({ category: ['bottoms', 'tops'] }).category).toBe('bottoms')
  })
})
