import { describe, expect, it } from 'vitest'
import { signPaymongoPayload, verifyPaymongoSignature } from './signature'

const secret = 'whsk_test_secret'
const body = '{"data":{"id":"evt_1"}}'
const t = 1_760_000_000
const nowMs = t * 1000 + 10_000

describe('verifyPaymongoSignature', () => {
  it('accepts a valid test-mode signature', () => {
    expect(verifyPaymongoSignature({ header: signPaymongoPayload(body, secret, t), rawBody: body, secret, livemode: false, nowMs })).toBe(true)
  })
  it('rejects a tampered body, wrong secret, or missing header', () => {
    const header = signPaymongoPayload(body, secret, t)
    expect(verifyPaymongoSignature({ header, rawBody: body + ' ', secret, livemode: false, nowMs })).toBe(false)
    expect(verifyPaymongoSignature({ header, rawBody: body, secret: 'other', livemode: false, nowMs })).toBe(false)
    expect(verifyPaymongoSignature({ header: null, rawBody: body, secret, livemode: false, nowMs })).toBe(false)
    expect(verifyPaymongoSignature({ header: 'garbage', rawBody: body, secret, livemode: false, nowMs })).toBe(false)
  })
  it('rejects stale timestamps (replays)', () => {
    const header = signPaymongoPayload(body, secret, t)
    expect(verifyPaymongoSignature({ header, rawBody: body, secret, livemode: false, nowMs: (t + 3600) * 1000 })).toBe(false)
  })
  it('checks the li signature in live mode', () => {
    const header = signPaymongoPayload(body, secret, t).replace(/te=([0-9a-f]+),li=/, 'te=,li=$1')
    expect(verifyPaymongoSignature({ header, rawBody: body, secret, livemode: true, nowMs })).toBe(true)
    expect(verifyPaymongoSignature({ header, rawBody: body, secret, livemode: false, nowMs })).toBe(false)
  })
})
