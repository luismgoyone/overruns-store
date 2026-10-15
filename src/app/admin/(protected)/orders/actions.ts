'use server'

import { revalidatePath } from 'next/cache'
import { canTransition, ORDER_STATUSES } from '@/lib/admin/order-status'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { OrderStatus } from '@/lib/catalog/constants'

const isStatus = (s: string): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s)

export async function updateOrderStatus(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const from = String(formData.get('from') ?? '')
  const to = String(formData.get('to') ?? '')
  if (!isStatus(from) || !isStatus(to) || !canTransition(from, to)) throw new Error(`Can't move an order from ${from} to ${to}.`)
  // The status guard makes a stale double-click a no-op instead of a wrong transition.
  const { error } = await supabase.from('orders').update({ status: to }).eq('id', id).eq('status', from)
  if (error) throw error
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${id}`)
}
