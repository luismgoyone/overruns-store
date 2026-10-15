import type { OrderStatus } from '@/lib/catalog/constants'

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'cancelled'] as const satisfies readonly OrderStatus[]

// Refunds for paid orders happen in the PayMongo dashboard, so paid → cancelled is out of scope for the POC.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['cancelled'],
  paid: ['shipped'],
  shipped: [],
  cancelled: [],
}

export const nextStatuses = (s: OrderStatus) => TRANSITIONS[s]
export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to)
