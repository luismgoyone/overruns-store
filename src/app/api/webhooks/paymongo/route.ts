import { revalidatePath } from 'next/cache'
import { sendOrderConfirmation } from '@/lib/email/send-order-confirmation'
import { handlePaymongoWebhook } from '@/lib/paymongo/webhook'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const result = await handlePaymongoWebhook(
    { rawBody: await request.text(), signatureHeader: request.headers.get('paymongo-signature') },
    {
      secret: process.env.PAYMONGO_WEBHOOK_SECRET ?? '',
      async markPaid(checkoutId) {
        const { data, error } = await createAdminClient().rpc('mark_order_paid', { p_checkout_id: checkoutId })
        if (error) throw error
        if (data) {
          // Stock changed: refresh cached catalog pages.
          revalidatePath('/')
          revalidatePath('/shop')
          revalidatePath('/product/[slug]', 'page')
        }
        return data
      },
      sendConfirmation: sendOrderConfirmation,
      nowMs: () => Date.now(),
    },
  )
  return Response.json(result.body, { status: result.status })
}
