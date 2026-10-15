# The Overruns Project — Store POC

A mobile-first storefront for overrun apparel: browse size-stocked products, check out with GCash, Maya or card through **PayMongo test mode**, get a confirmation email, and manage products and orders from `/admin`.

Spec: [`docs/spec.md`](docs/spec.md) · Plan: [`docs/superpowers/plans/2026-10-15-overruns-store-poc.md`](docs/superpowers/plans/2026-10-15-overruns-store-poc.md)

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · PayMongo Checkout · Resend · Vitest + pgTAP · Vercel

## Prerequisites

- Node.js 22+ and npm
- Docker Desktop (runs the local Supabase stack)

## Local setup

```bash
npm install
cp .env.example .env.local

# Start Supabase without services this app doesn't use (saves several GB of disk)
npx supabase start -x edge-runtime,realtime,logflare,vector,imgproxy,supavisor
npx supabase status   # copy API URL, anon key and service_role key into .env.local

npm run dev           # http://localhost:3000
```

`npx supabase db reset` re-applies the migration and loads the 12 demo products from `supabase/seed.sql`. Studio runs at http://127.0.0.1:54323.

Leave `RESEND_API_KEY` empty locally and confirmation emails are printed to the server log instead of sent.

### Admin user

Sign-ups are disabled, so the owner account is created by hand:

1. Studio → Authentication → **Add user** (email + password, auto-confirm).
2. SQL editor:
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'owner@example.com';
   ```
3. Sign in at `/admin/login`.

## Tests

| Command | What it runs |
|---|---|
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:db` | pgTAP tests for RLS and `mark_order_paid` (needs local Supabase) |
| `npm run test:integration` | Catalog queries against the seeded local database |
| `npm run lint` / `npm run typecheck` / `npm run build` | Static checks and production build |

After changing the schema, run `npm run db:types` to regenerate `src/lib/supabase/database.types.ts`.

## Payments locally

Checkout needs `PAYMONGO_SECRET_KEY` (a **test** key, `sk_test_…`) to open the PayMongo page.

PayMongo can't reach `localhost`, so simulate the webhook instead. Set any `PAYMONGO_WEBHOOK_SECRET` in `.env.local`, start the app, then send a signed `checkout_session.payment.paid` event for a pending order's `paymongo_checkout_id`:

```bash
npx tsx scripts/simulate-paymongo-webhook.ts cs_xxx http://localhost:3000
```

The first call marks the order paid and lowers stock; repeating it is a no-op.

## Deploy (Vercel Hobby + Supabase Free)

1. **Supabase:** create a free project (region: Southeast Asia / Singapore), then
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push --include-seed
   ```
   Turn off "Allow new users to sign up" (Authentication → Providers → Email) and create the admin user as above.
2. **Vercel:** `npx vercel link`, add the env vars from `.env.example` for Production and Preview (`NEXT_PUBLIC_SITE_URL=https://<project>.vercel.app`), then `npx vercel --prod`.
3. **PayMongo webhook:** register `https://<project>.vercel.app/api/webhooks/paymongo` for `checkout_session.payment.paid`:
   ```bash
   curl -s https://api.paymongo.com/v1/webhooks -u "$PAYMONGO_SECRET_KEY:" -H 'Content-Type: application/json' \
     -d '{"data":{"attributes":{"url":"https://<project>.vercel.app/api/webhooks/paymongo","events":["checkout_session.payment.paid"]}}}'
   ```
   Put the returned `secret_key` (`whsk_…`) in Vercel as `PAYMONGO_WEBHOOK_SECRET` and redeploy.
4. **Resend:** add `RESEND_API_KEY`. Without a verified domain, Resend only delivers mail from `onboarding@resend.dev` to the Resend account owner's own address.

## Before each client demo

- [ ] Open the Supabase dashboard if the project has been idle for close to 7 days (free projects pause after a week).
- [ ] Do one test purchase end to end and check it shows as **paid** in `/admin/orders`.
- [ ] Use the Resend account owner's email at checkout (or verify a domain) so the confirmation email arrives.

## Before launch (after the POC)

- Vercel Pro (Hobby is non-commercial only)
- Supabase Pro (no pausing, daily backups)
- Custom domain, and verify it in Resend
- PayMongo live keys after business verification (no code changes)
