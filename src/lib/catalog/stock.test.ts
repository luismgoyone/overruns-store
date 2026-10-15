import { describe, expect, it } from 'vitest'
import { lowStockLabel, sizeStockNote, totalStock } from './stock'
import type { Product } from './types'

const product = { variants: [{ id: 'a', size: 'S', stock: 1 }, { id: 'b', size: 'M', stock: 2 }] } as Product

describe('stock helpers', () => {
  it('sums stock across sizes', () => expect(totalStock(product)).toBe(3))
  it('labels low stock only between 1 and 3', () => {
    expect(lowStockLabel(0)).toBeNull()
    expect(lowStockLabel(3)).toBe('Only 3 left')
    expect(lowStockLabel(4)).toBeNull()
  })
  it('notes low stock per size', () => {
    expect(sizeStockNote({ id: 'b', size: 'M', stock: 2 })).toBe('Only 2 left in M')
    expect(sizeStockNote({ id: 'c', size: 'OS', stock: 1 })).toBe('Only 1 left')
    expect(sizeStockNote({ id: 'd', size: 'L', stock: 9 })).toBeNull()
  })
})
