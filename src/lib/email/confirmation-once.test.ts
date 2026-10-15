import { describe, expect, it, vi } from 'vitest'
import { resendConfirmation, sendConfirmationOnce, type ConfirmationDeps } from './confirmation-once'

// An in-memory stand-in for `update orders set confirmation_sent_at = now() where id = ? and confirmation_sent_at is null`.
function fakeDb(sentAt: string | null = null) {
  const row = { sentAt }
  const deps: ConfirmationDeps & { row: typeof row } = {
    row,
    claim: vi.fn(async () => {
      await Promise.resolve()
      if (row.sentAt) return false
      row.sentAt = 'now'
      return true
    }),
    release: vi.fn(async () => { row.sentAt = null }),
    markSent: vi.fn(async () => { row.sentAt = 'now' }),
    send: vi.fn(async () => {}),
  }
  return deps
}

describe('sendConfirmationOnce', () => {
  it('sends for a paid order whose email has not gone out yet', async () => {
    const d = fakeDb()
    await expect(sendConfirmationOnce('order-1', d)).resolves.toBe('sent')
    expect(d.send).toHaveBeenCalledTimes(1)
    expect(d.row.sentAt).toBe('now')
  })
  it('does nothing when the confirmation was already sent', async () => {
    const d = fakeDb('earlier')
    await expect(sendConfirmationOnce('order-1', d)).resolves.toBe('skipped')
    expect(d.send).not.toHaveBeenCalled()
  })
  it('sends once when the webhook and reconciliation race', async () => {
    const d = fakeDb()
    const results = await Promise.all([sendConfirmationOnce('order-1', d), sendConfirmationOnce('order-1', d), sendConfirmationOnce('order-1', d)])
    expect(d.send).toHaveBeenCalledTimes(1)
    expect(results.sort()).toEqual(['sent', 'skipped', 'skipped'])
  })
  it('releases the claim when sending fails so a retry can send', async () => {
    const d = fakeDb()
    vi.mocked(d.send).mockRejectedValueOnce(new Error('resend down'))
    await expect(sendConfirmationOnce('order-1', d)).rejects.toThrow('resend down')
    expect(d.row.sentAt).toBeNull()
    await expect(sendConfirmationOnce('order-1', d)).resolves.toBe('sent')
    expect(d.send).toHaveBeenCalledTimes(2)
  })
})

describe('resendConfirmation', () => {
  it('sends even if already sent and records the time', async () => {
    const d = fakeDb('earlier')
    await resendConfirmation('order-1', d)
    expect(d.send).toHaveBeenCalledTimes(1)
    expect(d.markSent).toHaveBeenCalledWith('order-1')
  })
})
