import { describe, expect, it, vi } from 'vitest'
import { handleCronRequest } from './cron'

const summary = { checked: 2, cancelled: 1, paid: 1, failed: 0 }
const run = () => vi.fn().mockResolvedValue(summary)

describe('handleCronRequest', () => {
  it('runs the job for Vercel cron with the right bearer token', async () => {
    const job = run()
    const r = await handleCronRequest('Bearer s3cret-value', { cronSecret: 's3cret-value', job })
    expect(r).toEqual({ status: 200, body: { ok: true, ...summary } })
    expect(job).toHaveBeenCalledTimes(1)
  })
  it.each([[null], [''], ['Bearer wrong'], ['s3cret-value'], ['Bearer s3cret-valueX']])('rejects authorization %j', async (header) => {
    const job = run()
    const r = await handleCronRequest(header, { cronSecret: 's3cret-value', job })
    expect(r.status).toBe(401)
    expect(job).not.toHaveBeenCalled()
  })
  it('refuses to run at all when CRON_SECRET is not configured', async () => {
    const job = run()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const cronSecret of [undefined, '']) {
      const r = await handleCronRequest('Bearer ', { cronSecret, job })
      expect(r.status).toBe(500)
    }
    expect(job).not.toHaveBeenCalled()
  })
  it('reports a failed job as 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await handleCronRequest('Bearer s3cret-value', { cronSecret: 's3cret-value', job: vi.fn().mockRejectedValue(new Error('db down')) })
    expect(r.status).toBe(500)
  })
})
