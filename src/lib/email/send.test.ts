import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendEmail } from './send'

const msg = { to: 'juan@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' }

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('sendEmail without RESEND_API_KEY', () => {
  it('logs and skips outside production', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    await expect(sendEmail(msg)).resolves.toBeUndefined()
    expect(info).toHaveBeenCalled()
  })
  it('fails loudly in production so the email is retried once the key is set', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('VERCEL_ENV', 'production')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(sendEmail(msg)).rejects.toThrow('RESEND_API_KEY')
    expect(error).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY is not set in production'), expect.anything())
  })
})
