'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { canTransition, ORDER_STATUSES } from '@/lib/admin/order-status'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { OrderStatus } from '@/lib/catalog/constants'
import { revalidateCatalog } from '@/lib/catalog/revalidate'
import { resendOrderConfirmation, sendConfirmationIfUnsent } from '@/lib/email/send-order-confirmation'
import { cancelPendingOrder, reconcileOrder } from '@/lib/orders/payment-ops-server'
import { isUuid } from '@/lib/orders/queries'

const isStatus = (s: string): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s)

function orderId(formData: FormData): string {
  const id = String(formData.get('id') ?? '')
  if (!isUuid(id)) throw new Error('Invalid order id.')
  return id
}

function backToOrder(id: string, notice: string): never {
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${id}`)
  redirect(`/admin/orders/${id}?notice=${notice}`)
}

export async function updateOrderStatus(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = orderId(formData)
  const from = String(formData.get('from') ?? '')
  const to = String(formData.get('to') ?? '')
  if (!isStatus(from) || !isStatus(to) || !canTransition(from, to)) throw new Error(`Can't move an order from ${from} to ${to}.`)

  if (to === 'cancelled') {
    // Close the PayMongo payment page first, so the customer can't pay an order we've cancelled.
    const result = await cancelPendingOrder(id, { onStockChange: revalidateCatalog })
    const notice = { cancelled: 'cancelled', paid: 'already-paid', not_pending: 'not-pending', error: 'cancel-failed' }[result.kind]
    backToOrder(id, notice)
  }

  // The status guard makes a stale double-click a no-op instead of a wrong transition.
  const { error } = await supabase.from('orders').update({ status: to }).eq('id', id).eq('status', from)
  if (error) throw error
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${id}`)
}

/** Ask PayMongo directly whether a pending order was paid (for when the webhook never arrived). */
export async function recheckPayment(formData: FormData) {
  await requireAdmin()
  const id = orderId(formData)
  const result = await reconcileOrder(id, { onStockChange: revalidateCatalog })
  backToOrder(id, `recheck-${result.replace('_', '-')}`)
}

export async function resendConfirmation(formData: FormData) {
  await requireAdmin()
  const id = orderId(formData)
  let notice = 'resent'
  try {
    await resendOrderConfirmation(id)
  } catch (err) {
    console.error('[admin] resend confirmation failed', { orderId: id, err })
    notice = 'resend-failed'
  }
  backToOrder(id, notice)
}

/** The owner chose to fulfil an order that was paid after it was cancelled: mark it paid and take stock. */
export async function acceptConflictedPayment(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = orderId(formData)
  const { data, error } = await supabase.rpc('accept_conflicted_payment', { p_order_id: id })
  if (error) throw error
  if (!data) backToOrder(id, 'not-conflicted')
  revalidateCatalog()
  try {
    await sendConfirmationIfUnsent(id)
  } catch (err) {
    console.error('[admin] confirmation after fulfilling a conflicted payment failed', { orderId: id, err })
  }
  backToOrder(id, 'fulfilled')
}
