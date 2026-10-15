import type { Category, Size } from './constants'

export type Variant = { id: string; size: Size; stock: number }

export type Product = {
  id: string
  slug: string
  name: string
  description: string
  category: Category
  priceCentavos: number
  retailPriceCentavos: number | null
  images: string[]
  isActive: boolean
  isFeatured: boolean
  createdAt: string
  variants: Variant[]
}
