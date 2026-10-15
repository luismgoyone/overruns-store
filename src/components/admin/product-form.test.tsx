import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '@/lib/catalog/types'
import { ProductForm } from './product-form'

const saveProduct = vi.fn()
vi.mock('@/app/admin/(protected)/products/actions', () => ({ saveProduct: (...args: unknown[]) => saveProduct(...args) }))
vi.mock('./image-uploader', () => ({ ImageUploader: () => <input type="hidden" name="images" value="[]" /> }))

const product: Product = {
  id: '0f8fad5b-d9cb-469f-a165-70867728950e', slug: 'coach-jacket', name: 'Coach Jacket', description: 'Nylon',
  category: 'outerwear', priceCentavos: 149000, retailPriceCentavos: 429900, images: [],
  isActive: true, isFeatured: true, createdAt: '2026-10-01T00:00:00Z',
  variants: [{ id: 'v1', size: 'M', stock: 5 }],
}

const input = (name: string) => document.querySelector<HTMLInputElement>(`[name="${name}"]`)!

beforeEach(() => saveProduct.mockReset())

describe('ProductForm', () => {
  it('remembers the loaded stock so a save only applies the change (no lost sales)', () => {
    render(<ProductForm product={product} />)
    expect(input('stock_orig_M').value).toBe('5')
    expect(input('stock_orig_M').type).toBe('hidden')
    expect(document.querySelector('[name="stock_orig_L"]')).toBeNull()
  })

  it('keeps the submitted values after a rejected save', async () => {
    saveProduct.mockResolvedValue({
      status: 'invalid',
      fieldErrors: { slug: 'Another product already uses this slug.' },
      values: { name: 'X', slug: 'taken', description: 'Soft', category: 'tops', price: '690', retailPrice: '', stock_M: '2', isActive: 'on' },
    })
    render(<ProductForm product={null} />)
    fireEvent.change(input('name'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }))

    expect(await screen.findByText('Another product already uses this slug.')).toBeInTheDocument()
    expect(saveProduct).toHaveBeenCalledTimes(1)
    expect(input('name').value).toBe('X')
    expect(input('slug').value).toBe('taken')
    expect(document.querySelector<HTMLTextAreaElement>('[name="description"]')!.value).toBe('Soft')
    expect(document.querySelector<HTMLSelectElement>('[name="category"]')!.value).toBe('tops')
    expect(input('price').value).toBe('690')
    expect(input('stock_M').value).toBe('2')
    expect(input('stock_L').value).toBe('')
    expect(input('isActive').checked).toBe(true)
    expect(input('isFeatured').checked).toBe(false)
  })

  it('prefers the submitted values over the saved product, including unchecked boxes', async () => {
    saveProduct.mockResolvedValue({
      status: 'error', message: 'Database unavailable',
      values: { id: product.id, name: 'Coach Jacket v2', slug: '', description: '', category: 'tops', price: '1,000', retailPrice: '', stock_M: '', stock_L: '3' },
    })
    render(<ProductForm product={product} />)
    expect(input('name').value).toBe('Coach Jacket')
    expect(input('isFeatured').checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable')
    expect(input('name').value).toBe('Coach Jacket v2')
    expect(input('price').value).toBe('1,000')
    expect(input('retailPrice').value).toBe('')
    expect(input('stock_M').value).toBe('')
    expect(input('stock_L').value).toBe('3')
    expect(input('isActive').checked).toBe(false)
    expect(input('isFeatured').checked).toBe(false)
  })

  it('refreshes the fields on every new result', async () => {
    saveProduct
      .mockResolvedValueOnce({ status: 'invalid', fieldErrors: { price: 'Bad price' }, values: { name: 'First', price: 'abc' } })
      .mockResolvedValueOnce({ status: 'invalid', fieldErrors: { price: 'Bad price again' }, values: { name: 'Second', price: 'xyz' } })
    render(<ProductForm product={null} />)
    fireEvent.change(input('name'), { target: { value: 'First' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }))
    expect(await screen.findByText('Bad price')).toBeInTheDocument()
    expect(input('name').value).toBe('First')
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }))
    expect(await screen.findByText('Bad price again')).toBeInTheDocument()
    await waitFor(() => expect(input('name').value).toBe('Second'))
    expect(input('price').value).toBe('xyz')
  })
})
