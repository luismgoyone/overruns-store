import 'server-only'
import { siteUrl } from '@/lib/config'
import type { OwnerAlert } from '@/lib/orders/payments'
import { getOrderDetail } from '@/lib/orders/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderOwnerAlert } from './owner-alert'
import { sendEmail } from './send'

/** Emails OWNER_NOTIFY_EMAIL about an order that needs attention. Silently skipped when it isn't set. */
export async function notifyOwner(orderId: string, alerts: OwnerAlert[]): Promise<void> {
  const to = process.env.OWNER_NOTIFY_EMAIL?.trim()
  if (!to || alerts.length === 0) return
  const order = await getOrderDetail(createAdminClient(), orderId)
  if (!order) throw new Error(`Order ${orderId} not found`)
  await sendEmail({ to, ...renderOwnerAlert(order, alerts, siteUrl()) })
}
