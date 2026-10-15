import { createHmac, timingSafeEqual } from 'node:crypto'

const hmac = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex')

// PayMongo header format: "t=<unix seconds>,te=<test sig>,li=<live sig>"; sig = HMAC-SHA256(secret, `${t}.${rawBody}`).
export function signPaymongoPayload(rawBody: string, secret: string, timestampSec: number): string {
  return `t=${timestampSec},te=${hmac(secret, `${timestampSec}.${rawBody}`)},li=`
}

export function verifyPaymongoSignature(opts: {
  header: string | null
  rawBody: string
  secret: string
  livemode: boolean
  nowMs: number
  toleranceSec?: number
}): boolean {
  const { header, rawBody, secret, livemode, nowMs, toleranceSec = 300 } = opts
  if (!header || !secret) return false
  const parts = Object.fromEntries(header.split(',').map((kv) => {
    const i = kv.indexOf('=')
    return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]
  }))
  const t = Number(parts.t)
  const given = livemode ? parts.li : parts.te
  if (!Number.isFinite(t) || !given) return false
  if (Math.abs(nowMs / 1000 - t) > toleranceSec) return false
  const expected = Buffer.from(hmac(secret, `${t}.${rawBody}`), 'hex')
  const actual = Buffer.from(given, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
