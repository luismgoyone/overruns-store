// Usage: npx tsx scripts/simulate-paymongo-webhook.ts cs_xxx [http://localhost:3000]
// Sends a correctly signed checkout_session.payment.paid event, the same way PayMongo would.
import { signPaymongoPayload } from '../src/lib/paymongo/signature'

process.loadEnvFile('.env.local')
const [checkoutId, base = 'http://localhost:3000'] = process.argv.slice(2)
const secret = process.env.PAYMONGO_WEBHOOK_SECRET
if (!checkoutId || !secret) {
  console.error('Usage: simulate-paymongo-webhook.ts <cs_id> [baseUrl]  (needs PAYMONGO_WEBHOOK_SECRET in .env.local)')
  process.exit(1)
}
const body = JSON.stringify({
  data: { id: `evt_sim_${Date.now()}`, type: 'event', attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: checkoutId, type: 'checkout_session', attributes: {} } } },
})
// No top-level await: this package is CommonJS, so tsx compiles the script as CJS.
async function main(secret: string) {
  const res = await fetch(`${base}/api/webhooks/paymongo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Paymongo-Signature': signPaymongoPayload(body, secret, Math.floor(Date.now() / 1000)) },
    body,
  })
  console.log(res.status, await res.text())
}
main(secret).catch((err) => {
  console.error(err)
  process.exit(1)
})
