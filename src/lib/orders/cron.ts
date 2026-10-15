import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (s: string) => createHash('sha256').update(s).digest()

/** Vercel cron sends `Authorization: Bearer <CRON_SECRET>`. */
export async function handleCronRequest<T extends object>(
  authorization: string | null,
  { cronSecret, job }: { cronSecret: string | undefined; job: () => Promise<T> },
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!cronSecret) {
    console.error('[cron] CRON_SECRET is not set; refusing to run')
    return { status: 500, body: { error: 'cron secret not configured' } }
  }
  if (!authorization || !timingSafeEqual(digest(authorization), digest(`Bearer ${cronSecret}`))) {
    return { status: 401, body: { error: 'unauthorized' } }
  }
  try {
    return { status: 200, body: { ok: true, ...(await job()) } }
  } catch (err) {
    console.error('[cron] job failed', err)
    return { status: 500, body: { error: 'job failed' } }
  }
}
