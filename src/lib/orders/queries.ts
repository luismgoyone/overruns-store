import type { OrderStatus, Size } from '@/lib/catalog/constants'
import { addressSchema, type Address } from '@/lib/checkout/schema'
import type { Db } from '@/lib/supabase/server'

export type OrderItem = { productName: string; size: Size; qty: number; priceCentavos: number }
export type OrderDetail = {
  id: string
  customerName: string
  email: string
  phone: string
  address: Address | null
  subtotalCentavos: number
  shippingCentavos: number
  totalCentavos: number
  status: OrderStatus
  oversold: boolean
  createdAt: string
  items: OrderItem[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s: string) => UUID.test(s)

export async function getOrderDetail(db: Db, id: string): Promise<OrderDetail | null> {
  if (!isUuid(id)) return null
  const { data, error } = await db
    .from('orders')
    .select('id, customer_name, email, phone, address, subtotal_centavos, shipping_centavos, total_centavos, status, oversold, created_at, order_items(product_name, size, qty, price_centavos)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const address = addressSchema.safeParse(data.address)
  return {
    id: data.id,
    customerName: data.customer_name,
    email: data.email,
    phone: data.phone,
    address: address.success ? address.data : null,
    subtotalCentavos: data.subtotal_centavos,
    shippingCentavos: data.shipping_centavos,
    totalCentavos: data.total_centavos,
    status: data.status,
    oversold: data.oversold,
    createdAt: data.created_at,
    items: data.order_items.map((i) => ({ productName: i.product_name, size: i.size, qty: i.qty, priceCentavos: i.price_centavos })),
  }
}
