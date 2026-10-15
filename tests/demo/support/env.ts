// Shared by playwright.demo.config.ts, the demo spec and the PayMongo mock.
import { execFileSync } from 'node:child_process'

// Not 3000: the owner's `next dev` may be running there.
export const APP_PORT = 3217
export const APP_URL = `http://localhost:${APP_PORT}`
export const MOCK_PORT = 4327
export const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`

// A made-up webhook secret shared by the app and the mock (no real PayMongo account is involved).
export const DEMO_WEBHOOK_SECRET = 'whsk_demo_not_a_real_secret'

// Every row the demo adds is tagged with these so teardown can remove exactly them.
export const DEMO_EMAIL_PATTERN = 'demo+%@example.com'
export const DEMO_SHOPPER_EMAIL = 'demo+shopper@example.com'
export const DEMO_ADMIN_EMAIL = 'demo-admin@example.com'
export const DEMO_ADMIN_PASSWORD = 'overruns-demo-only'

export type LocalSupabase = { url: string; anonKey: string; serviceRoleKey: string }

// Keys of the already-running local stack (`npx supabase start`), read at run time so none are committed.
export function localSupabase(): LocalSupabase {
  const cached = process.env.DEMO_SUPABASE_URL
  if (cached) {
    return { url: cached, anonKey: process.env.DEMO_SUPABASE_ANON_KEY!, serviceRoleKey: process.env.DEMO_SUPABASE_SERVICE_ROLE_KEY! }
  }
  let out: string
  try {
    out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    throw new Error('demo: the local Supabase stack is not running (npx supabase start)')
  }
  const vars = Object.fromEntries(
    out.split('\n').flatMap((line) => {
      const m = line.match(/^([A-Z_]+)="?(.*?)"?$/)
      return m ? [[m[1], m[2]]] : []
    }),
  )
  const local = { url: vars.API_URL, anonKey: vars.ANON_KEY, serviceRoleKey: vars.SERVICE_ROLE_KEY }
  if (!local.url || !local.anonKey || !local.serviceRoleKey) throw new Error('demo: could not read local Supabase keys')
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(local.url)) throw new Error(`demo: refusing a non-local Supabase (${local.url})`)
  process.env.DEMO_SUPABASE_URL = local.url
  process.env.DEMO_SUPABASE_ANON_KEY = local.anonKey
  process.env.DEMO_SUPABASE_SERVICE_ROLE_KEY = local.serviceRoleKey
  return local
}
