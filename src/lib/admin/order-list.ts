import type { OrderStatus } from '@/lib/catalog/constants'
import { ORDER_STATUSES } from './order-status'

export const ORDERS_PER_PAGE = 50
export const STALE_PENDING_HOURS = 24
const MAX_PAGE = 10_000

export type OrderListParams = { status: OrderStatus | null; page: number; showStale: boolean; from: number; to: number; staleBefore: string }

export function parseOrderListParams(sp: { status?: string; page?: string; stale?: string }, now = new Date()): OrderListParams {
  const status = ORDER_STATUSES.find((s) => s === sp.status) ?? null
  const n = /^\d+$/.test(sp.page ?? '') ? Number(sp.page) : 1
  const page = n >= 1 && n <= MAX_PAGE ? n : 1
  const from = (page - 1) * ORDERS_PER_PAGE
  return {
    status, page, showStale: sp.stale === '1', from, to: from + ORDERS_PER_PAGE - 1,
    staleBefore: new Date(now.getTime() - STALE_PENDING_HOURS * 3600_000).toISOString(),
  }
}

export function orderListHref({ status, page, showStale }: { status: OrderStatus | null; page: number; showStale: boolean }): string {
  const q = new URLSearchParams()
  if (status) q.set('status', status)
  if (showStale) q.set('stale', '1')
  if (page > 1) q.set('page', String(page))
  const s = q.toString()
  return s ? `/admin/orders?${s}` : '/admin/orders'
}
