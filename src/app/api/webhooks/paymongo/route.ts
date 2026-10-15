import 'server-only'
import { revalidateCatalog } from '@/lib/catalog/revalidate'
import { notifyOwner } from '@/lib/email/notify-owner'
import { sendConfirmationIfUnsent } from '@/lib/email/send-order-confirmation'
import { expectedLivemode, paymongoSecretKey, recordPayment } from '@/lib/orders/payment-ops-server'
import { handlePaymongoWebhook, MAX_WEBHOOK_BYTES } from '@/lib/paymongo/webhook'

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_WEBHOOK_BYTES) {
    return Response.json({ error: 'payload too large' }, { status: 413 })
  }
  const result = await handlePaymongoWebhook(
    { rawBody: await request.text(), signatureHeader: request.headers.get('paymongo-signature') },
    {
      secret: process.env.PAYMONGO_WEBHOOK_SECRET ?? '',
      expectedLivemode: expectedLivemode(paymongoSecretKey()),
      async recordPayment(checkoutId, info) {
        const r = await recordPayment(checkoutId, info)
        if (r.outcome === 'paid') revalidateCatalog() // stock changed
        return r
      },
      sendConfirmation: sendConfirmationIfUnsent,
      notifyOwner,
      nowMs: () => Date.now(),
    },
  )
  return Response.json(result.body, { status: result.status })
}
