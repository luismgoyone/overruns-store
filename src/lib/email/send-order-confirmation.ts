import 'server-only'
import { siteUrl } from '@/lib/config'
import { getOrderDetail } from '@/lib/orders/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderOrderConfirmation } from './order-confirmation'
import { sendEmail } from './send'

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await getOrderDetail(createAdminClient(), orderId)
  if (!order) throw new Error(`Order ${orderId} not found`)
  await sendEmail({ to: order.email, ...renderOrderConfirmation(order, siteUrl()) })
}
