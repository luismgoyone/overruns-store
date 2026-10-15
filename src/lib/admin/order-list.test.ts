import { describe, expect, it } from 'vitest'
import { orderListHref, parseOrderListParams, STALE_PENDING_HOURS } from './order-list'

const now = new Date('2026-10-16T12:00:00Z')

describe('parseOrderListParams', () => {
  it('defaults to page 1 of everything, hiding stale pending orders', () => {
    expect(parseOrderListParams({}, now)).toEqual({ status: null, page: 1, showStale: false, from: 0, to: 49, staleBefore: '2026-10-15T12:00:00.000Z' })
    expect(STALE_PENDING_HOURS).toBe(24)
  })
  it('pages 50 at a time and ignores junk', () => {
    expect(parseOrderListParams({ page: '3' }, now)).toMatchObject({ page: 3, from: 100, to: 149 })
    for (const page of ['0', '-1', 'abc', '1.5', '100000']) expect(parseOrderListParams({ page }, now).page).toBe(1)
  })
  it('reads the status filter and the stale toggle', () => {
    expect(parseOrderListParams({ status: 'paid', stale: '1' }, now)).toMatchObject({ status: 'paid', showStale: true })
    expect(parseOrderListParams({ status: 'bogus' }, now).status).toBeNull()
  })
})

describe('orderListHref', () => {
  it('keeps only non-default params', () => {
    expect(orderListHref({ status: null, page: 1, showStale: false })).toBe('/admin/orders')
    expect(orderListHref({ status: 'pending', page: 2, showStale: true })).toBe('/admin/orders?status=pending&stale=1&page=2')
  })
})
