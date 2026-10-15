// Local stand-in for PayMongo, used only by the demo recording (`npm run demo:record`).
// The app server runs with redirect-external.mjs preloaded, so its call to
// https://api.paymongo.com arrives here as /__ext/api.paymongo.com/...
//
//   POST /__ext/api.paymongo.com/v1/checkout_sessions
//        → a fake session whose checkout_url points back at this server
//   GET  /pay/<session id>
//        → "pays" instantly: sends the app a correctly signed
//          checkout_session.payment.paid webhook (the real route marks the
//          order paid), then redirects the shopper to the order's success_url
//   any other /__ext/<host>/... → 404, so nothing else can pretend to succeed
//
// GET /__calls lists every intercepted request.

import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { signPaymongoPayload } from '../../../src/lib/paymongo/signature'
import { APP_URL, DEMO_WEBHOOK_SECRET, MOCK_PORT, MOCK_URL } from './env'

type Session = { successUrl: string; totalCentavos: number; paid: boolean }
const sessions = new Map<string, Session>()
const calls: { host: string; method: string; path: string }[] = []

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function createSession(req: IncomingMessage, res: ServerResponse) {
  type LineItem = { amount: number; quantity: number }
  const { data } = JSON.parse(await readBody(req)) as { data: { attributes: { success_url: string; line_items: LineItem[] } } }
  const id = `cs_demo${randomBytes(12).toString('hex')}`
  const totalCentavos = data.attributes.line_items.reduce((sum, l) => sum + l.amount * l.quantity, 0)
  sessions.set(id, { successUrl: data.attributes.success_url, totalCentavos, paid: false })
  return json(res, 200, {
    data: { id, type: 'checkout_session', attributes: { checkout_url: `${MOCK_URL}/pay/${id}`, status: 'active', livemode: false } },
  })
}

async function pay(res: ServerResponse, id: string) {
  const session = sessions.get(id)
  if (!session) return json(res, 404, { error: 'unknown checkout session' })
  if (!session.paid) {
    const body = JSON.stringify({
      data: {
        id: `evt_demo_${randomBytes(8).toString('hex')}`,
        type: 'event',
        attributes: {
          type: 'checkout_session.payment.paid',
          livemode: false,
          data: {
            id,
            type: 'checkout_session',
            attributes: {
              status: 'active',
              livemode: false,
              payments: [{ id: `pay_demo${randomBytes(8).toString('hex')}`, attributes: { status: 'paid', amount: session.totalCentavos, currency: 'PHP' } }],
            },
          },
        },
      },
    })
    const webhook = await fetch(`${APP_URL}/api/webhooks/paymongo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Paymongo-Signature': signPaymongoPayload(body, DEMO_WEBHOOK_SECRET, Math.floor(Date.now() / 1000)) },
      body,
    })
    console.log('[mock-paymongo] webhook', webhook.status, await webhook.text())
    session.paid = webhook.ok
  }
  res.writeHead(303, { Location: session.successUrl }).end()
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://mock')
    if (url.pathname === '/') return json(res, 200, { ok: true })
    if (url.pathname === '/__calls') return json(res, 200, calls)
    const pay_ = url.pathname.match(/^\/pay\/(cs_demo[0-9a-f]+)$/)
    if (pay_ && req.method === 'GET') return await pay(res, pay_[1])
    const ext = url.pathname.match(/^\/__ext\/([^/]+)(\/.*)?$/)
    if (ext) {
      const [, host, path = '/'] = ext
      calls.push({ host, method: req.method ?? 'GET', path })
      if (host === 'api.paymongo.com' && req.method === 'POST' && path === '/v1/checkout_sessions') return await createSession(req, res)
      return json(res, 404, { error: `mock: no fake for ${req.method} ${host}${path}` })
    }
    return json(res, 404, { error: 'not found' })
  } catch (err) {
    console.error('[mock-paymongo]', err)
    json(res, 500, { error: String(err) })
  }
}).listen(MOCK_PORT, '127.0.0.1', () => console.log(`[mock-paymongo] listening on ${MOCK_URL}`))
