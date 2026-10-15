import 'server-only'
import { STALE_PENDING_HOURS } from '@/lib/admin/order-list'
import { revalidateCatalog } from '@/lib/catalog/revalidate'
import { handleCronRequest } from '@/lib/orders/cron'
import { expireStalePendingCore } from '@/lib/orders/payment-ops'
import { buildPaymentOps } from '@/lib/orders/payment-ops-server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH = 100

// Daily (vercel.json): reconcile, then expire + cancel, pending orders older than 24 hours.
export async function GET(request: Request) {
  const result = await handleCronRequest(request.headers.get('authorization'), {
    cronSecret: process.env.CRON_SECRET,
    async job() {
      const cutoff = new Date(Date.now() - STALE_PENDING_HOURS * 3600_000).toISOString()
      const summary = await expireStalePendingCore(async () => {
        const { data, error } = await createAdminClient()
          .from('orders').select('id').eq('status', 'pending').lt('created_at', cutoff)
          .order('created_at', { ascending: true }).limit(BATCH)
        if (error) throw error
        return data.map((o) => o.id)
      }, buildPaymentOps({ onStockChange: revalidateCatalog }))
      console.info('[cron] expire-pending', summary)
      return summary
    },
  })
  return Response.json(result.body, { status: result.status })
}
