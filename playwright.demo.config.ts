import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { APP_PORT, APP_URL, DEMO_WEBHOOK_SECRET, MOCK_URL, localSupabase } from './tests/demo/support/env'

/**
 * Records the portfolio demo clip: `npm run demo:record` (needs the local Supabase stack running).
 *
 * Runs the production build (no dev indicator) with no real outside services:
 * - `.env.local` is never applied: __NEXT_PROCESSED_ENV tells Next the env is
 *   already loaded, and every key the app reads is set here. Supabase points at
 *   the local stack; PayMongo and Resend get dummy values.
 * - Every outgoing request from the server to a non-local host is redirected to
 *   a local PayMongo mock (tests/demo/support/mock-paymongo.mts) by a preload,
 *   so api.paymongo.com and api.resend.com are never contacted.
 * - RESEND_API_KEY is empty, so the confirmation email is only logged.
 */
const supabase = localSupabase()

const demoEnv = {
  __NEXT_PROCESSED_ENV: 'true',
  NEXT_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: `--import=${resolve('tests/demo/support/redirect-external.mjs')}`,
  DEMO_MOCK_URL: MOCK_URL,

  NEXT_PUBLIC_SITE_URL: APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: supabase.url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase.anonKey,
  SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
  NEXT_PUBLIC_SHIPPING_FEE_CENTAVOS: '15000',
  PAYMONGO_SECRET_KEY: 'sk_test_demo_not_a_real_key',
  PAYMONGO_WEBHOOK_SECRET: DEMO_WEBHOOK_SECRET,
  PAYMONGO_PAYMENT_METHODS: 'card,gcash,paymaya,qrph',
  RESEND_API_KEY: '',
  EMAIL_FROM: 'The Overruns Project <demo@example.com>',
  OWNER_NOTIFY_EMAIL: '',
  CRON_SECRET: 'demo-cron-secret',
}

export default defineConfig({
  testDir: './tests/demo',
  outputDir: './test-results/demo-artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 180_000,
  use: { baseURL: APP_URL, video: 'off', trace: 'off', screenshot: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx tests/demo/support/mock-paymongo.mts',
      url: MOCK_URL,
      reuseExistingServer: false,
    },
    {
      command: `./node_modules/.bin/next build && ./node_modules/.bin/next start --port ${APP_PORT}`,
      url: APP_URL,
      env: { ...demoEnv, PORT: String(APP_PORT) },
      // Never attach to a server started some other way (it could have real keys).
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: 'pipe',
    },
  ],
})
