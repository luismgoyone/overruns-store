import 'server-only'
import { siteUrl } from '@/lib/config'
import { getOrderDetail } from '@/lib/orders/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { resendConfirmation, sendConfirmationOnce, type ConfirmationDeps } from './confirmation-once'
import { renderOrderConfirmation } from './order-confirmation'
import { sendEmail } from './send'

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await getOrderDetail(createAdminClient(), orderId)
  if (!order) throw new Error(`Order ${orderId} not found`)
  await sendEmail({ to: order.email, ...renderOrderConfirmation(order, siteUrl()) })
}

function confirmationDeps(): ConfirmationDeps {
  const db = createAdminClient()
  return {
    async claim(orderId) {
      const { data, error } = await db
        .from('orders')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', orderId)
        .is('confirmation_sent_at', null)
        .in('status', ['paid', 'shipped'])
        .select('id')
      if (error) throw error
      return data.length > 0
    },
    async release(orderId) {
      const { error } = await db.from('orders').update({ confirmation_sent_at: null }).eq('id', orderId)
      if (error) throw error
    },
    async markSent(orderId) {
      const { error } = await db.from('orders').update({ confirmation_sent_at: new Date().toISOString() }).eq('id', orderId)
      if (error) throw error
    },
    send: sendOrderConfirmation,
  }
}

/** Sends the confirmation if no other path (webhook, reconciliation) has. */
export async function sendConfirmationIfUnsent(orderId: string): Promise<void> {
  await sendConfirmationOnce(orderId, confirmationDeps())
}

export async function resendOrderConfirmation(orderId: string): Promise<void> {
  await resendConfirmation(orderId, confirmationDeps())
}
