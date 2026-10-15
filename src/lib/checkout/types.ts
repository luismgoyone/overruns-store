import type { Size } from '@/lib/catalog/constants'

export type CartProblem = {
  variantId: string
  reason: 'unavailable' | 'insufficient_stock' | 'price_changed'
  available: number
  currentPriceCentavos?: number
  name?: string
  size?: Size
}

export type DbVariant = {
  id: string
  size: Size
  stock: number
  product: { id: string; name: string; isActive: boolean; priceCentavos: number }
}

export type PricedLine = { variantId: string; productName: string; size: Size; qty: number; priceCentavos: number }
