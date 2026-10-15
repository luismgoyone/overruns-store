# Overruns Store POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first storefront for The Overruns Project where a shopper browses size-stocked overrun apparel, checks out through PayMongo test mode (GCash/Maya/card), gets a confirmation email, and the owner manages products and orders from `/admin`.

**Architecture:** One Next.js App Router app. Supabase holds products, variants (stock per size), orders and images, with Row Level Security doing authorization. The cart lives in localStorage. A server action re-prices the cart from the database and creates a pending order plus a PayMongo Checkout Session. A signed webhook calls one Postgres function (`mark_order_paid`) that marks the order paid and lowers stock idempotently, then sends a Resend email. Pure logic (money, cart, pricing, signatures, form parsing) sits in small `src/lib/**` modules with Vitest tests. Database rules are tested with pgTAP.

**Tech Stack:** Next.js 16 (App Router, TypeScript, Turbopack), React 19, Tailwind CSS v4, Supabase (Postgres, Auth, Storage, `@supabase/ssr`, Supabase CLI and local Docker stack), PayMongo Checkout API, Resend, Zod 4, Vitest + Testing Library, pgTAP, Vercel Hobby.

**Spec:** `docs/spec.md` (copy of https://claude.ai/artifact/4HaqLZ9TcqKohmDwKNNE8g)

## Global Constraints

- Money is integer centavos everywhere (DB, cart, PayMongo `amount`). Format only at display time with `formatPeso()`.
- Prices and stock are always re-read on the server at checkout. Never trust the browser's cart.
- Only the webhook marks an order `paid`. The `success_url` redirect only displays status.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `RESEND_API_KEY`) are read only in modules that `import 'server-only'`.
- Flat shipping is one config value: `NEXT_PUBLIC_SHIPPING_FEE_CENTAVOS` (default `15000` = ₱150).
- Colors: background `#F5F3EE`, cards `#FFFFFF`, text `#111111`, muted `#6B6B6B`, accent `#E85D2A`. Fonts: Archivo Black (display, uppercase) and Inter (body, 16px base). Square corners (0–4px radius), 1px black borders, no drop shadows.
- Text on the orange accent is `#111111`, not white. White on `#E85D2A` is about 3.4:1 and fails WCAG AA.
- Mobile-first: design at 375px wide, tap targets at least 44px (`h-11`).
- Every product card and product page shows the struck-through retail price next to the bold overrun price, whenever a retail price exists.
- No customer accounts. Only the owner logs in. Every admin server action calls `requireAdmin()` itself; the layout check is not enough.
- Next.js 16 APIs: `params`, `searchParams` and `cookies()` are async (await them), and middleware is `src/proxy.ts` exporting `proxy`. If the installed version ships docs in `node_modules/next/dist/docs/`, check them before using an API you are unsure of.
- Free-tier constraints from the spec: Vercel Hobby is non-commercial, Supabase Free pauses after 1 week idle, and Resend Free allows 100 emails a day.

**Deliberate additions to the spec's data model** (each is needed by another part of the spec):

| Addition | Why |
|---|---|
| `products.retail_price_centavos` (nullable) | The visual direction requires the struck-through original price, but the spec's table has no column for it |
| `products.is_featured` | The home page has a "featured products" section |
| `orders.oversold`, `orders.paid_at` | Flags an order that was paid after its stock ran out (see Review Focus #1) |
| `admins` table + `is_admin()` | RLS needs a way to tell "the admin" apart from any other signed-in user |
| Size `OS` (one size) | Accessories (totes, caps) have no XS–XXL size |
| `unique (order_id, variant_id)` on `order_items` | The cart merges by variant, and stock math assumes one row per variant |

The announcement bar says "Flat ₱150 shipping nationwide". The Stitch prompt's "Free shipping over P2,000" has no matching rule in the spec, so the bar doesn't promise it. The header search icon from the mockup is out of scope.

## Review Focus

1. **Two shoppers pay for the last unit of a size.** Stock is only lowered when a payment lands, so both payments go through. Expected: both orders are `paid`, stock stops at 0 and never goes negative, and the second order is flagged `oversold` so the owner sees it in admin. *Test: Task 2 pgTAP `mark_order_paid` (oversold case). Task 12 shows the badge.*
2. **PayMongo sends the same webhook twice** (it retries). Expected: stock goes down once and only one email is sent. *Test: Task 2 pgTAP (second call is a no-op), and Task 9 handler test (no email when `markPaid` returns null).*
3. **A stale cart in localStorage**: the product was deactivated, the stock dropped, or the price changed since it was added. Expected: checkout refuses, names each problem, and offers a one-tap "Update my cart" fix. *Test: Task 7 `priceCart` + `applyCartProblems` tests.*
4. **The shopper cancels or backs out of the PayMongo page.** Expected: they land on `/cart` with a notice, the cart is intact, and the pending order doesn't hold stock. *Test: Task 7 start-checkout test asserts `cancel_url`. Task 6 CartView test asserts the cancelled banner with lines intact.*
5. **A forged, malformed or unrelated webhook request.** Expected: bad signature → 401, unparseable body → 400, other event types → 200 ignored, and none of them change the database. *Test: Task 9 signature and handler tests.*

---

## Prerequisites (do once, before Task 1)

- Node.js 22 or later (`node -v`) and npm.
- Docker Desktop running. The Supabase CLI runs the local Postgres, Auth and Storage stack in Docker, so Tasks 1–12 need **no** cloud accounts. PayMongo test keys are needed from Task 7 manual checks onward (free and instant). Cloud accounts are created in Task 13.
- Optional: Stitch mockups (spec build step 1) are a manual design step and don't block code.

## File Structure

```
src/
  app/
    layout.tsx                      # html/body, fonts, CartProvider
    globals.css                     # Tailwind v4 theme tokens
    not-found.tsx
    (shop)/layout.tsx               # announcement bar, header, footer
    (shop)/page.tsx                 # Home
    (shop)/shop/page.tsx
    (shop)/product/[slug]/page.tsx
    (shop)/about/page.tsx
    (shop)/cart/page.tsx
    (shop)/checkout/page.tsx
    (shop)/checkout/actions.ts      # startCheckout server action
    (shop)/order/[id]/page.tsx
    api/webhooks/paymongo/route.ts
    admin/login/page.tsx
    admin/login/actions.ts
    admin/(protected)/layout.tsx    # requireAdmin + sidebar
    admin/(protected)/page.tsx      # redirect → /admin/orders
    admin/(protected)/products/{page.tsx,new/page.tsx,[id]/page.tsx,actions.ts}
    admin/(protected)/orders/{page.tsx,[id]/page.tsx,actions.ts}
  proxy.ts                          # Next 16 middleware: session refresh + /admin guard
  components/
    ui/styles.ts                    # shared button/input class strings
    layout/{site-header.tsx,site-footer.tsx}
    cart/{cart-provider.tsx,cart-link.tsx,cart-view.tsx,clear-cart-on-mount.tsx}
    catalog/{price-tag.tsx,overrun-badge.tsx,product-card.tsx,product-grid.tsx,category-chips.tsx,shop-filters.tsx,product-gallery.tsx,size-picker.tsx,add-to-cart.tsx}
    checkout/checkout-form.tsx
    order/pending-refresher.tsx
    admin/{product-form.tsx,image-uploader.tsx,status-badge.tsx}
  lib/
    money.ts  config.ts
    supabase/{database.types.ts,server.ts,browser.ts,public.ts,admin.ts}
    catalog/{constants.ts,types.ts,params.ts,images.ts,mappers.ts,queries.ts,stock.ts}
    cart/{cart.ts,totals.ts}
    checkout/{schema.ts,types.ts,price-cart.ts,problems.ts,start-checkout.ts,deps.ts}
    paymongo/{client.ts,signature.ts,webhook.ts}
    orders/{format.ts,queries.ts}
    email/{order-confirmation.ts,send.ts,send-order-confirmation.ts}
    auth/{paths.ts,require-admin.ts}
    admin/{product-form.ts,order-status.ts,downscale-image.ts}
  test/server-only-stub.ts
supabase/
  config.toml
  migrations/20261015000000_init.sql
  seed.sql
  tests/database/{rls.test.sql,mark_order_paid.test.sql}
scripts/simulate-paymongo-webhook.ts
```

---

### Task 1: Scaffold, theme tokens, money and config helpers

**Files:**
- Create: Next.js scaffold, `vitest.config.mts`, `vitest.setup.ts`, `src/test/server-only-stub.ts`, `.env.example`
- Create: `src/lib/money.ts`, `src/lib/money.test.ts`, `src/lib/config.ts`, `src/lib/config.test.ts`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `package.json` scripts, `next.config.ts`

**Interfaces:**
- Produces: `formatPeso(centavos: number): string`; `SHIPPING_FEE_CENTAVOS: number`; `parseShippingFee(raw: string | undefined): number`; `siteUrl(): string`; `INSTAGRAM_HANDLE`, `INSTAGRAM_URL`; Tailwind tokens `paper`, `card`, `ink`, `muted`, `tag`, `font-display`, `font-sans`.

- [ ] **Step 1: Scaffold into a temp dir and move it in** (the repo already holds `.git` and `docs/`, which `create-next-app` refuses to overwrite)

```bash
cd /Users/luis/Documents/Projects
npx create-next-app@latest overruns-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --yes
rsync -a --exclude .git overruns-scaffold/ overruns-store/
rm -rf overruns-scaffold
cd overruns-store
npm i zod @supabase/supabase-js @supabase/ssr resend server-only
npm i -D vitest @vitejs/plugin-react jsdom vite-tsconfig-paths @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event supabase tsx
```

- [ ] **Step 2: Configure Vitest**

`vitest.config.mts`:
```ts
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    env: loadEnv(mode, process.cwd(), ''),
  },
}))
```

`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
})
```

`src/test/server-only-stub.ts`:
```ts
// Vitest stand-in for the `server-only` package, which throws outside React Server Components.
export {}
```

Add to `package.json` `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:integration": "SUPABASE_INTEGRATION=1 vitest run integration",
"test:db": "supabase test db",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 3: Write failing tests for money and config**

`src/lib/money.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { formatPeso } from './money'

describe('formatPeso', () => {
  it('formats whole pesos without decimals', () => {
    expect(formatPeso(189900)).toBe('₱1,899')
    expect(formatPeso(0)).toBe('₱0')
  })
  it('shows centavos when present', () => {
    expect(formatPeso(15050)).toBe('₱150.50')
  })
  it('rejects non-integer centavos', () => {
    expect(() => formatPeso(1.5)).toThrow(/integer/)
  })
})
```

`src/lib/config.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseShippingFee } from './config'

describe('parseShippingFee', () => {
  it('defaults to ₱150 when unset or invalid', () => {
    expect(parseShippingFee(undefined)).toBe(15000)
    expect(parseShippingFee('')).toBe(15000)
    expect(parseShippingFee('abc')).toBe(15000)
    expect(parseShippingFee('-5')).toBe(15000)
    expect(parseShippingFee('99.5')).toBe(15000)
  })
  it('accepts whole centavo amounts including zero', () => {
    expect(parseShippingFee('20000')).toBe(20000)
    expect(parseShippingFee('0')).toBe(0)
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. Cannot resolve `./money` and `./config`.

- [ ] **Step 5: Implement**

`src/lib/money.ts`:
```ts
export function formatPeso(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new Error(`formatPeso expects integer centavos, got ${centavos}`)
  const digits = centavos % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(centavos / 100)
}
```

`src/lib/config.ts`:
```ts
const DEFAULT_SHIPPING_FEE_CENTAVOS = 15000

export function parseShippingFee(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_SHIPPING_FEE_CENTAVOS
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_SHIPPING_FEE_CENTAVOS
}

// NEXT_PUBLIC_ vars are inlined at build time, so reference them literally.
export const SHIPPING_FEE_CENTAVOS = parseShippingFee(process.env.NEXT_PUBLIC_SHIPPING_FEE_CENTAVOS)

export const INSTAGRAM_HANDLE = 'theoverrunsproject'
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return 'http://localhost:3000'
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (5 tests).

- [ ] **Step 7: Theme tokens, fonts, env example, image config**

Replace `src/app/globals.css`:
```css
@import "tailwindcss";

@theme {
  --color-paper: #f5f3ee;
  --color-card: #ffffff;
  --color-ink: #111111;
  --color-muted: #6b6b6b;
  --color-tag: #e85d2a;
  --radius-tag: 4px;
}

@theme inline {
  --font-sans: var(--font-inter);
  --font-display: var(--font-archivo-black);
}

html {
  font-size: 16px;
}

body {
  background: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-sans);
}

.font-display {
  text-transform: uppercase;
  letter-spacing: -0.01em;
}
```

Replace `src/app/layout.tsx` (it gets `CartProvider` in Task 4):
```tsx
import type { Metadata } from 'next'
import { Archivo_Black, Inter } from 'next/font/google'
import './globals.css'

const display = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-archivo-black' })
const sans = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: 'The Overruns Project', template: '%s · The Overruns Project' },
  description: 'Real brands. Overrun prices. Authentic factory-surplus clothing in the Philippines.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
```

Replace `src/app/page.tsx` with a temporary placeholder so the build passes until Task 5 moves Home into `(shop)`:
```tsx
export default function Page() {
  return <main className="p-4 font-display text-2xl">The Overruns Project</main>
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next'

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined

const nextConfig: NextConfig = {
  images: {
    // Local Supabase serves from 127.0.0.1, which the optimizer refuses; skip optimization in dev.
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      ...(supabaseHost ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] : []),
    ],
  },
}

export default nextConfig
```

`.env.example` (and copy it to `.env.local`; `.env*.local` is already gitignored):
```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=          # from `npx supabase status`
SUPABASE_SERVICE_ROLE_KEY=              # from `npx supabase status` (server only)
NEXT_PUBLIC_SHIPPING_FEE_CENTAVOS=15000
PAYMONGO_SECRET_KEY=                    # sk_test_... (server only)
PAYMONGO_WEBHOOK_SECRET=                # whsk_... (server only)
PAYMONGO_PAYMENT_METHODS=card,gcash,paymaya,qrph
RESEND_API_KEY=                         # empty = emails are logged to the console
EMAIL_FROM=The Overruns Project <onboarding@resend.dev>
```

- [ ] **Step 8: Verify build, lint and types**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all succeed.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with theme tokens, Vitest, money and config helpers"
```

---

### Task 2: Supabase schema, RLS, stock function and seed

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/20261015000000_init.sql`, `supabase/seed.sql`
- Test: `supabase/tests/database/rls.test.sql`, `supabase/tests/database/mark_order_paid.test.sql`
- Create (generated): `src/lib/supabase/database.types.ts`

**Interfaces:**
- Produces: tables `products`, `product_variants`, `orders`, `order_items`, `admins`. Enums `product_category` (`tops|bottoms|outerwear|kids|accessories`), `product_size` (`XS|S|M|L|XL|XXL|OS`), `order_status` (`pending|paid|shipped|cancelled`). SQL functions `is_admin() → boolean` and `mark_order_paid(p_checkout_id text) → uuid | null` (service role only). Public storage bucket `product-images`. TS type `Database`.

- [ ] **Step 1: Init and start local Supabase**

```bash
npx supabase init
npx supabase start
npx supabase status   # copy API URL, anon key, service_role key into .env.local
```

In `supabase/config.toml`, under `[auth]`, set `enable_signup = false` (the owner account is created by hand, so the public anon key can't be used to sign up).

- [ ] **Step 2: Write the failing pgTAP tests**

`supabase/tests/database/rls.test.sql`:
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into products (id, slug, name, category, price_centavos, is_active) values
  ('00000000-0000-0000-0000-0000000000a1', 'rls-active-tee', 'Active Tee', 'tops', 50000, true),
  ('00000000-0000-0000-0000-0000000000a2', 'rls-hidden-tee', 'Hidden Tee', 'tops', 50000, false);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000ad01', 'owner@example.com');
insert into admins (user_id) values ('00000000-0000-0000-0000-00000000ad01');
insert into orders (id, customer_name, email, phone, address, subtotal_centavos, shipping_centavos, total_centavos)
values ('00000000-0000-0000-0000-0000000000c1', 'Juan', 'juan@example.com', '+639171234567', '{}', 50000, 15000, 65000);

set local role anon;
select is((select count(*)::int from products where slug like 'rls-%'), 1, 'anon sees only active products');
select is((select count(*)::int from orders), 0, 'anon cannot read orders');
select throws_ok(
  $$insert into orders (customer_name, email, phone, address, subtotal_centavos, shipping_centavos, total_centavos)
    values ('x', 'x@example.com', '0', '{}', 0, 0, 0)$$,
  '42501', null, 'anon cannot create orders');
select throws_ok($$select public.mark_order_paid('cs_x')$$, '42501', null, 'anon cannot call mark_order_paid');
-- Under RLS an UPDATE on rows you may not write affects 0 rows rather than raising.
select is(
  (with u as (update products set price_centavos = 1 where slug = 'rls-active-tee' returning id) select count(*)::int from u),
  0, 'anon cannot edit products');
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::int from products where slug like 'rls-%'), 2, 'admin sees inactive products');
select is((select count(*)::int from orders where id = '00000000-0000-0000-0000-0000000000c1'), 1, 'admin reads orders');

select * from finish();
rollback;
```

`supabase/tests/database/mark_order_paid.test.sql`:
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into products (id, slug, name, category, price_centavos)
values ('00000000-0000-0000-0000-0000000000b1', 'mop-cap', 'Test Cap', 'tops', 50000);
insert into product_variants (id, product_id, size, stock)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'M', 2);

insert into orders (id, customer_name, email, phone, address, subtotal_centavos, shipping_centavos, total_centavos, paymongo_checkout_id) values
  ('00000000-0000-0000-0000-0000000000e1', 'A', 'a@example.com', '+639170000001', '{}', 100000, 15000, 115000, 'cs_test_1'),
  ('00000000-0000-0000-0000-0000000000e2', 'B', 'b@example.com', '+639170000002', '{}', 50000, 15000, 65000, 'cs_test_2');
insert into order_items (order_id, variant_id, product_name, size, qty, price_centavos) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'Test Cap', 'M', 2, 50000),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1', 'Test Cap', 'M', 1, 50000);

select is(mark_order_paid('cs_test_1'), '00000000-0000-0000-0000-0000000000e1'::uuid, 'returns the order id when it marks it paid');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000000d1'), 0, 'stock lowered by qty');
select is(mark_order_paid('cs_test_1'), null::uuid, 'a repeated webhook is a no-op');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000000d1'), 0, 'stock not lowered twice');
select is(mark_order_paid('cs_test_2'), '00000000-0000-0000-0000-0000000000e2'::uuid, 'an oversold order is still marked paid');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000000d1'), 0, 'stock never goes negative');
select ok((select oversold from orders where id = '00000000-0000-0000-0000-0000000000e2'), 'the oversold order is flagged');
select is(mark_order_paid('cs_unknown'), null::uuid, 'an unknown checkout id returns null');

select * from finish();
rollback;
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:db`
Expected: FAIL with `relation "products" does not exist`.

- [ ] **Step 4: Write the migration**

`supabase/migrations/20261015000000_init.sql`:
```sql
create type public.product_category as enum ('tops', 'bottoms', 'outerwear', 'kids', 'accessories');
create type public.product_size as enum ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS');
create type public.order_status as enum ('pending', 'paid', 'shipped', 'cancelled');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  category public.product_category not null,
  price_centavos integer not null check (price_centavos > 0),
  retail_price_centavos integer check (retail_price_centavos is null or retail_price_centavos > price_centavos),
  images text[] not null default '{}',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size public.product_size not null,
  stock integer not null default 0 check (stock >= 0),
  unique (product_id, size)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  email text not null,
  phone text not null,
  address jsonb not null,
  subtotal_centavos integer not null check (subtotal_centavos >= 0),
  shipping_centavos integer not null check (shipping_centavos >= 0),
  total_centavos integer not null check (total_centavos = subtotal_centavos + shipping_centavos),
  status public.order_status not null default 'pending',
  paymongo_checkout_id text unique,
  oversold boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_created_at_idx on public.orders (created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  size public.product_size not null,
  qty integer not null check (qty > 0),
  price_centavos integer not null check (price_centavos >= 0),
  unique (order_id, variant_id)
);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admins enable row level security; -- no policies: service role only

create policy "anyone reads active products" on public.products
  for select using (is_active or public.is_admin());
create policy "admin writes products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "anyone reads variants of visible products" on public.product_variants
  for select using (exists (
    select 1 from public.products p where p.id = product_id and (p.is_active or public.is_admin())
  ));
create policy "admin writes variants" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Orders are created by server code with the service role (which bypasses RLS).
create policy "admin reads orders" on public.orders
  for select to authenticated using (public.is_admin());
create policy "admin updates orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin reads order items" on public.order_items
  for select to authenticated using (public.is_admin());

-- Called by the PayMongo webhook. Idempotent: only a pending order transitions.
create function public.mark_order_paid(p_checkout_id text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
begin
  update orders set status = 'paid', paid_at = now()
  where paymongo_checkout_id = p_checkout_id and status = 'pending'
  returning id into v_order_id;

  if v_order_id is null then
    return null;
  end if;

  -- Lock the variant rows so concurrent webhooks serialize on stock.
  perform 1 from product_variants v
  join order_items oi on oi.variant_id = v.id
  where oi.order_id = v_order_id
  for update of v;

  update orders set oversold = true
  where id = v_order_id and exists (
    select 1 from order_items oi join product_variants v on v.id = oi.variant_id
    where oi.order_id = v_order_id and v.stock < oi.qty
  );

  update product_variants v set stock = greatest(v.stock - oi.qty, 0)
  from order_items oi
  where oi.order_id = v_order_id and oi.variant_id = v.id;

  return v_order_id;
end;
$$;

revoke execute on function public.mark_order_paid(text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text) to service_role;

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "admin uploads product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy "admin updates product images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and public.is_admin());
create policy "admin deletes product images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());
```

- [ ] **Step 5: Write the seed** (12 demo products. The owner replaces them with real photos and items through admin in Task 11.)

`supabase/seed.sql`:
```sql
insert into public.products (slug, name, description, category, price_centavos, retail_price_centavos, is_featured, created_at) values
  ('oxford-button-down-white', 'Oxford Button-Down Shirt', 'Crisp cotton oxford from a premium label''s surplus run. Regular fit, button-down collar.', 'tops', 69000, 189900, true, now() - interval '1 day'),
  ('heavyweight-tee-black', 'Heavyweight Tee', '240gsm cotton tee with a boxy fit. Factory overrun, tags removed.', 'tops', 45000, 129500, true, now() - interval '2 days'),
  ('striped-polo-navy', 'Striped Polo', 'Piqué polo with contrast stripes. Limited sizes from the last run.', 'tops', 59000, 159900, false, now() - interval '3 days'),
  ('crewneck-sweatshirt-grey', 'Crewneck Sweatshirt', 'Brushed fleece crewneck in heather grey.', 'tops', 89000, 249900, false, now() - interval '4 days'),
  ('slim-chino-khaki', 'Slim Chino', 'Stretch cotton chino, slim tapered leg.', 'bottoms', 99000, 279900, true, now() - interval '5 days'),
  ('cargo-shorts-olive', 'Cargo Shorts', 'Ripstop cargo shorts with six pockets.', 'bottoms', 65000, 179900, false, now() - interval '6 days'),
  ('track-pants-black', 'Track Pants', 'Tricot track pants with side stripes and zip cuffs.', 'bottoms', 79000, 219900, false, now() - interval '7 days'),
  ('coach-jacket-black', 'Coach Jacket', 'Water-resistant nylon coach jacket with snap front.', 'outerwear', 149000, 429900, true, now() - interval '8 days'),
  ('quilted-vest-navy', 'Quilted Vest', 'Lightweight quilted vest, great for aircon offices.', 'outerwear', 119000, 349900, false, now() - interval '9 days'),
  ('kids-graphic-tee-yellow', 'Kids Graphic Tee', 'Soft cotton tee for kids with a front print.', 'kids', 29000, 79900, false, now() - interval '10 days'),
  ('canvas-tote-natural', 'Canvas Tote', 'Heavy canvas tote with inner pocket.', 'accessories', 35000, 99000, false, now() - interval '11 days'),
  ('dad-cap-washed-blue', 'Dad Cap', 'Washed cotton cap with adjustable strap.', 'accessories', 39000, 119900, false, now() - interval '12 days');

-- Placeholder photos until the owner uploads real ones.
update public.products set images = array[
  'https://picsum.photos/seed/' || slug || '-1/800/800',
  'https://picsum.photos/seed/' || slug || '-2/800/800'
];

insert into public.product_variants (product_id, size, stock)
select p.id, v.size::public.product_size, v.stock
from (values
  ('oxford-button-down-white', 'S', 2), ('oxford-button-down-white', 'M', 3), ('oxford-button-down-white', 'L', 1), ('oxford-button-down-white', 'XL', 0),
  ('heavyweight-tee-black', 'S', 5), ('heavyweight-tee-black', 'M', 8), ('heavyweight-tee-black', 'L', 6), ('heavyweight-tee-black', 'XL', 2),
  ('striped-polo-navy', 'M', 1), ('striped-polo-navy', 'L', 0), ('striped-polo-navy', 'XL', 2),
  ('crewneck-sweatshirt-grey', 'S', 0), ('crewneck-sweatshirt-grey', 'M', 0), ('crewneck-sweatshirt-grey', 'L', 0),
  ('slim-chino-khaki', 'S', 2), ('slim-chino-khaki', 'M', 4), ('slim-chino-khaki', 'L', 3), ('slim-chino-khaki', 'XL', 1), ('slim-chino-khaki', 'XXL', 1),
  ('cargo-shorts-olive', 'M', 3), ('cargo-shorts-olive', 'L', 2), ('cargo-shorts-olive', 'XL', 0),
  ('track-pants-black', 'XS', 1), ('track-pants-black', 'S', 2), ('track-pants-black', 'M', 2),
  ('coach-jacket-black', 'M', 2), ('coach-jacket-black', 'L', 1),
  ('quilted-vest-navy', 'S', 1), ('quilted-vest-navy', 'M', 1), ('quilted-vest-navy', 'L', 2), ('quilted-vest-navy', 'XL', 1),
  ('kids-graphic-tee-yellow', 'XS', 4), ('kids-graphic-tee-yellow', 'S', 3),
  ('canvas-tote-natural', 'OS', 10),
  ('dad-cap-washed-blue', 'OS', 2)
) as v (slug, size, stock)
join public.products p on p.slug = v.slug;
```

- [ ] **Step 6: Apply and run tests**

Run: `npx supabase db reset && npm run test:db`
Expected: PASS. `rls.test.sql` 7/7 and `mark_order_paid.test.sql` 8/8.

- [ ] **Step 7: Generate TypeScript types**

Run: `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts`
Add to `package.json` scripts: `"db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts"`.

- [ ] **Step 8: Commit**

```bash
git add supabase src/lib/supabase/database.types.ts package.json
git commit -m "feat(db): schema, RLS, idempotent mark_order_paid, storage bucket and seed"
```

---

### Task 3: Supabase clients and catalog queries

**Files:**
- Create: `src/lib/supabase/{server.ts,browser.ts,public.ts,admin.ts}`
- Create: `src/lib/catalog/{constants.ts,types.ts,params.ts,images.ts,mappers.ts,queries.ts}`
- Test: `src/lib/catalog/{params.test.ts,images.test.ts,mappers.test.ts,catalog.integration.test.ts}`

**Interfaces:**
- Consumes: `Database` from Task 2.
- Produces:
  - `createClient(): Promise<Db>` (server, cookie-aware, `server.ts`), `createBrowserSupabase(): Db` (`browser.ts`), `createPublicClient(): Db` (anon, no cookies, cacheable; `public.ts`), `createAdminClient(): Db` (service role, server-only; `admin.ts`). `type Db = SupabaseClient<Database>` exported from `server.ts`.
  - `type Size`, `type Category`, `type OrderStatus`, `SIZES: readonly Size[]`, `CATEGORIES: readonly { slug: Category; label: string }[]`
  - `type Variant = { id: string; size: Size; stock: number }`
  - `type Product = { id; slug; name; description; category: Category; priceCentavos: number; retailPriceCentavos: number | null; images: string[]; isActive: boolean; isFeatured: boolean; createdAt: string; variants: Variant[] }`
  - `type ShopSort = 'newest' | 'price-asc' | 'price-desc'`; `type ShopFilters = { category: Category | null; size: Size | null; sort: ShopSort }`; `parseShopParams(sp): ShopFilters`
  - `productImageUrl(path: string): string`; `PRODUCT_IMAGES_BUCKET = 'product-images'`
  - `PRODUCT_SELECT`, `toProduct(row): Product`, `filterBySize(products, size): Product[]`
  - `listProducts(db, filters)`, `listLatest(db, limit)`, `listFeatured(db, limit)`, `getProductBySlug(db, slug): Promise<Product | null>`, `getProductById(db, id): Promise<Product | null>` (admin, includes inactive), `listAllProducts(db): Promise<Product[]>` (admin)

- [ ] **Step 1: Write failing unit tests**

`src/lib/catalog/params.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseShopParams } from './params'

describe('parseShopParams', () => {
  it('defaults to all products, newest first', () => {
    expect(parseShopParams({})).toEqual({ category: null, size: null, sort: 'newest' })
  })
  it('accepts known category, size (any case) and sort', () => {
    expect(parseShopParams({ category: 'tops', size: 'xl', sort: 'price-asc' })).toEqual({ category: 'tops', size: 'XL', sort: 'price-asc' })
  })
  it('ignores unknown or empty values and uses the first of repeated keys', () => {
    expect(parseShopParams({ category: 'shoes', size: '', sort: 'random' })).toEqual({ category: null, size: null, sort: 'newest' })
    expect(parseShopParams({ category: ['bottoms', 'tops'] }).category).toBe('bottoms')
  })
})
```

`src/lib/catalog/images.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { productImageUrl } from './images'

afterEach(() => vi.unstubAllEnvs())

describe('productImageUrl', () => {
  it('passes absolute URLs through', () => {
    expect(productImageUrl('https://picsum.photos/seed/x/800/800')).toBe('https://picsum.photos/seed/x/800/800')
  })
  it('builds a public storage URL for a storage path', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    expect(productImageUrl('products/a b.jpg')).toBe('https://abc.supabase.co/storage/v1/object/public/product-images/products/a%20b.jpg')
  })
})
```

`src/lib/catalog/mappers.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { filterBySize, toProduct, type ProductRow } from './mappers'

const row = (over: Partial<ProductRow> = {}): ProductRow => ({
  id: 'p1', slug: 'tee', name: 'Tee', description: '', category: 'tops',
  price_centavos: 45000, retail_price_centavos: 129500, images: ['a.jpg'],
  is_active: true, is_featured: false, created_at: '2026-10-01T00:00:00Z',
  product_variants: [
    { id: 'v-xl', size: 'XL', stock: 1 },
    { id: 'v-s', size: 'S', stock: 0 },
    { id: 'v-m', size: 'M', stock: 2 },
  ],
  ...over,
})

describe('toProduct', () => {
  it('maps columns to camelCase and sorts variants XS→XXL→OS', () => {
    const p = toProduct(row())
    expect(p.priceCentavos).toBe(45000)
    expect(p.retailPriceCentavos).toBe(129500)
    expect(p.variants.map((v) => v.size)).toEqual(['S', 'M', 'XL'])
  })
})

describe('filterBySize', () => {
  it('keeps products that have the size in stock', () => {
    const products = [toProduct(row()), toProduct(row({ id: 'p2', slug: 'b', product_variants: [{ id: 'x', size: 'S', stock: 3 }] }))]
    expect(filterBySize(products, 'S').map((p) => p.id)).toEqual(['p2'])
    expect(filterBySize(products, null)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/catalog`
Expected: FAIL. The modules don't exist yet.

- [ ] **Step 3: Implement constants, types, params, images, mappers**

`src/lib/catalog/constants.ts`:
```ts
import type { Database } from '@/lib/supabase/database.types'

export type Size = Database['public']['Enums']['product_size']
export type Category = Database['public']['Enums']['product_category']
export type OrderStatus = Database['public']['Enums']['order_status']

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS'] as const satisfies readonly Size[]

export const CATEGORIES = [
  { slug: 'tops', label: 'Tops' },
  { slug: 'bottoms', label: 'Bottoms' },
  { slug: 'outerwear', label: 'Outerwear' },
  { slug: 'kids', label: 'Kids' },
  { slug: 'accessories', label: 'Accessories' },
] as const satisfies readonly { slug: Category; label: string }[]

export function sizeLabel(size: Size): string {
  return size === 'OS' ? 'One size' : size
}
```

`src/lib/catalog/types.ts`:
```ts
import type { Category, Size } from './constants'

export type Variant = { id: string; size: Size; stock: number }

export type Product = {
  id: string
  slug: string
  name: string
  description: string
  category: Category
  priceCentavos: number
  retailPriceCentavos: number | null
  images: string[]
  isActive: boolean
  isFeatured: boolean
  createdAt: string
  variants: Variant[]
}
```

`src/lib/catalog/params.ts`:
```ts
import { CATEGORIES, SIZES, type Category, type Size } from './constants'

export type ShopSort = 'newest' | 'price-asc' | 'price-desc'
export type ShopFilters = { category: Category | null; size: Size | null; sort: ShopSort }
type SearchParams = Record<string, string | string[] | undefined>

function first(sp: SearchParams, key: string): string | undefined {
  const v = sp[key]
  return Array.isArray(v) ? v[0] : v
}

export function parseShopParams(sp: SearchParams): ShopFilters {
  const categoryRaw = first(sp, 'category')
  const category = CATEGORIES.find((c) => c.slug === categoryRaw)?.slug ?? null
  const sizeRaw = first(sp, 'size')?.toUpperCase() ?? ''
  const size = (SIZES as readonly string[]).includes(sizeRaw) ? (sizeRaw as Size) : null
  const sortRaw = first(sp, 'sort')
  const sort: ShopSort = sortRaw === 'price-asc' || sortRaw === 'price-desc' ? sortRaw : 'newest'
  return { category, size, sort }
}
```

`src/lib/catalog/images.ts`:
```ts
export const PRODUCT_IMAGES_BUCKET = 'product-images'

export function productImageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${encoded}`
}
```

`src/lib/catalog/mappers.ts`:
```ts
import type { Database } from '@/lib/supabase/database.types'
import { SIZES, type Size } from './constants'
import type { Product } from './types'

type Tables = Database['public']['Tables']

export const PRODUCT_SELECT =
  'id, slug, name, description, category, price_centavos, retail_price_centavos, images, is_active, is_featured, created_at, product_variants(id, size, stock)' as const

export type ProductRow = Tables['products']['Row'] & {
  product_variants: Pick<Tables['product_variants']['Row'], 'id' | 'size' | 'stock'>[]
}

const sizeOrder = (s: Size) => SIZES.indexOf(s)

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    priceCentavos: row.price_centavos,
    retailPriceCentavos: row.retail_price_centavos,
    images: row.images,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    createdAt: row.created_at,
    variants: [...row.product_variants]
      .sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size))
      .map((v) => ({ id: v.id, size: v.size, stock: v.stock })),
  }
}

export function filterBySize(products: Product[], size: Size | null): Product[] {
  if (!size) return products
  return products.filter((p) => p.variants.some((v) => v.size === size && v.stock > 0))
}
```

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `npm test -- src/lib/catalog`
Expected: PASS.

- [ ] **Step 5: Supabase clients**

`src/lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export type Db = SupabaseClient<Database>

export async function createClient(): Promise<Db> {
  const cookieStore = await cookies()
  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component, where cookies are read-only; proxy.ts refreshes the session.
        }
      },
    },
  })
}
```

`src/lib/supabase/browser.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createBrowserSupabase() {
  return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
```

`src/lib/supabase/public.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Anonymous, cookie-free client for public catalog reads, so pages can be statically cached.
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

`src/lib/supabase/admin.ts`:
```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Service role: bypasses RLS. Only for order creation, the webhook and order pages.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Step 6: Write the integration test (needs `npx supabase start` and a seeded DB)**

`src/lib/catalog/catalog.integration.test.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/supabase/database.types'
import { getProductBySlug, listProducts } from './queries'

describe.skipIf(process.env.SUPABASE_INTEGRATION !== '1')('catalog queries against local Supabase', () => {
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  it('lists active products newest first', async () => {
    const products = await listProducts(db, { category: null, size: null, sort: 'newest' })
    expect(products.length).toBeGreaterThanOrEqual(12)
    const dates = products.map((p) => p.createdAt)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('filters by category and sorts by price', async () => {
    const products = await listProducts(db, { category: 'bottoms', size: null, sort: 'price-asc' })
    expect(products.every((p) => p.category === 'bottoms')).toBe(true)
    const prices = products.map((p) => p.priceCentavos)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
  })

  it('gets a product with variants in size order, or null', async () => {
    const p = await getProductBySlug(db, 'oxford-button-down-white')
    expect(p?.variants.map((v) => v.size)).toEqual(['S', 'M', 'L', 'XL'])
    expect(await getProductBySlug(db, 'does-not-exist')).toBeNull()
  })
})
```

- [ ] **Step 7: Implement queries**

`src/lib/catalog/queries.ts`:
```ts
import type { Db } from '@/lib/supabase/server'
import { filterBySize, PRODUCT_SELECT, toProduct, type ProductRow } from './mappers'
import type { ShopFilters } from './params'
import type { Product } from './types'

function rows(data: unknown): Product[] {
  return (data as ProductRow[]).map(toProduct)
}

export async function listProducts(db: Db, { category, size, sort }: ShopFilters): Promise<Product[]> {
  let query = db.from('products').select(PRODUCT_SELECT).eq('is_active', true)
  if (category) query = query.eq('category', category)
  query =
    sort === 'price-asc'
      ? query.order('price_centavos', { ascending: true })
      : sort === 'price-desc'
        ? query.order('price_centavos', { ascending: false })
        : query.order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) throw error
  // Size filtering happens in JS so each card keeps its full variant list for stock labels.
  return filterBySize(rows(data), size)
}

export async function listLatest(db: Db, limit = 6): Promise<Product[]> {
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).eq('is_active', true).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return rows(data)
}

export async function listFeatured(db: Db, limit = 4): Promise<Product[]> {
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).eq('is_active', true).eq('is_featured', true).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return rows(data)
}

export async function getProductBySlug(db: Db, slug: string): Promise<Product | null> {
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).eq('slug', slug).eq('is_active', true).maybeSingle()
  if (error) throw error
  return data ? toProduct(data as ProductRow) : null
}

export async function getProductById(db: Db, id: string): Promise<Product | null> {
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toProduct(data as ProductRow) : null
}

export async function listAllProducts(db: Db): Promise<Product[]> {
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).order('created_at', { ascending: false })
  if (error) throw error
  return rows(data)
}
```

- [ ] **Step 8: Run all tests**

Run: `npm test && npm run test:integration && npm run typecheck`
Expected: PASS. The integration suite runs 3 tests against local Supabase.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase src/lib/catalog
git commit -m "feat(catalog): Supabase clients and typed catalog queries"
```

---

### Task 4: Cart state (reducer, localStorage provider, header count)

**Files:**
- Create: `src/lib/cart/cart.ts`, `src/lib/cart/totals.ts`, `src/components/cart/cart-provider.tsx`, `src/components/cart/cart-link.tsx`, `src/components/ui/styles.ts`, `src/components/layout/site-header.tsx`, `src/components/layout/site-footer.tsx`, `src/app/(shop)/layout.tsx`
- Modify: `src/app/layout.tsx` (wrap in `CartProvider`)
- Test: `src/lib/cart/cart.test.ts`, `src/lib/cart/totals.test.ts`, `src/components/cart/cart-provider.test.tsx`

**Interfaces:**
- Consumes: `Size` (Task 3), `formatPeso`, `SHIPPING_FEE_CENTAVOS`, `INSTAGRAM_URL` (Task 1).
- Produces:
  - `type CartLine = { variantId: string; productId: string; slug: string; name: string; size: Size; priceCentavos: number; image: string | null; qty: number; maxQty: number }`
  - `type CartState = { lines: CartLine[]; hydrated: boolean }`, `EMPTY_CART`
  - `type CartAction = { type: 'add'; line: Omit<CartLine, 'qty'>; qty?: number } | { type: 'setQty'; variantId: string; qty: number } | { type: 'remove'; variantId: string } | { type: 'clear' } | { type: 'hydrate'; lines: CartLine[] }` (Task 7 adds `applyProblems`)
  - `cartReducer`, `cartCount(lines)`, `cartSubtotal(lines)`, `parseStoredCart(raw: string | null): CartLine[]`, `CART_STORAGE_KEY`, `MAX_QTY_PER_LINE = 10`
  - `computeTotals(subtotalCentavos, shippingFeeCentavos): { subtotal: number; shipping: number; total: number }`
  - `useCart(): { lines; count; subtotal; hydrated; dispatch }`, `<CartProvider>`
  - `buttonPrimary`, `buttonSecondary`, `inputBase` class strings

- [ ] **Step 1: Write failing reducer and totals tests**

`src/lib/cart/cart.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { cartCount, cartReducer, cartSubtotal, EMPTY_CART, MAX_QTY_PER_LINE, parseStoredCart, type CartLine, type CartState } from './cart'

const line = (over: Partial<Omit<CartLine, 'qty'>> = {}): Omit<CartLine, 'qty'> => ({
  variantId: 'v-m', productId: 'p1', slug: 'tee', name: 'Tee', size: 'M',
  priceCentavos: 50000, image: null, maxQty: 3, ...over,
})
const ready: CartState = { lines: [], hydrated: true }

describe('cartReducer', () => {
  it('adds a new line with qty 1', () => {
    const s = cartReducer(ready, { type: 'add', line: line() })
    expect(s.lines).toEqual([{ ...line(), qty: 1 }])
  })
  it('merges the same variant and caps at stock', () => {
    let s = cartReducer(ready, { type: 'add', line: line(), qty: 2 })
    s = cartReducer(s, { type: 'add', line: line(), qty: 2 })
    expect(s.lines).toHaveLength(1)
    expect(s.lines[0].qty).toBe(3)
  })
  it('ignores sold-out variants', () => {
    expect(cartReducer(ready, { type: 'add', line: line({ maxQty: 0 }) })).toBe(ready)
  })
  it('caps a line at MAX_QTY_PER_LINE', () => {
    const s = cartReducer(ready, { type: 'add', line: line({ maxQty: 50 }), qty: 99 })
    expect(s.lines[0].qty).toBe(MAX_QTY_PER_LINE)
  })
  it('setQty clamps to stock and removes at zero', () => {
    let s = cartReducer(ready, { type: 'add', line: line() })
    s = cartReducer(s, { type: 'setQty', variantId: 'v-m', qty: 9 })
    expect(s.lines[0].qty).toBe(3)
    s = cartReducer(s, { type: 'setQty', variantId: 'v-m', qty: 0 })
    expect(s.lines).toEqual([])
  })
  it('removes and clears but stays hydrated', () => {
    let s = cartReducer(ready, { type: 'add', line: line() })
    s = cartReducer(s, { type: 'add', line: line({ variantId: 'v-l', size: 'L' }) })
    s = cartReducer(s, { type: 'remove', variantId: 'v-m' })
    expect(s.lines.map((l) => l.variantId)).toEqual(['v-l'])
    s = cartReducer(s, { type: 'clear' })
    expect(s).toEqual({ lines: [], hydrated: true })
  })
  it('hydrate replaces lines and marks the cart hydrated', () => {
    const s = cartReducer(EMPTY_CART, { type: 'hydrate', lines: [{ ...line(), qty: 2 }] })
    expect(s.hydrated).toBe(true)
    expect(cartCount(s.lines)).toBe(2)
    expect(cartSubtotal(s.lines)).toBe(100000)
  })
})

describe('parseStoredCart', () => {
  it('returns an empty cart for missing or corrupt data', () => {
    expect(parseStoredCart(null)).toEqual([])
    expect(parseStoredCart('not json')).toEqual([])
    expect(parseStoredCart('{"lines":"nope"}')).toEqual([])
  })
  it('keeps valid lines, drops invalid ones and clamps qty', () => {
    const raw = JSON.stringify([{ ...line(), qty: 9 }, { variantId: 'broken' }])
    expect(parseStoredCart(raw)).toEqual([{ ...line(), qty: 3 }])
  })
})
```

`src/lib/cart/totals.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { computeTotals } from './totals'

describe('computeTotals', () => {
  it('adds flat shipping to a non-empty cart', () => {
    expect(computeTotals(100000, 15000)).toEqual({ subtotal: 100000, shipping: 15000, total: 115000 })
  })
  it('charges no shipping on an empty cart', () => {
    expect(computeTotals(0, 15000)).toEqual({ subtotal: 0, shipping: 0, total: 0 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/cart`
Expected: FAIL. The modules don't exist yet.

- [ ] **Step 3: Implement**

`src/lib/cart/cart.ts`:
```ts
import { z } from 'zod'
import { SIZES, type Size } from '@/lib/catalog/constants'

export const CART_STORAGE_KEY = 'overruns-cart-v1'
export const MAX_QTY_PER_LINE = 10

export type CartLine = {
  variantId: string
  productId: string
  slug: string
  name: string
  size: Size
  priceCentavos: number
  image: string | null
  qty: number
  maxQty: number
}

export type CartState = { lines: CartLine[]; hydrated: boolean }
export const EMPTY_CART: CartState = { lines: [], hydrated: false }

export type CartAction =
  | { type: 'add'; line: Omit<CartLine, 'qty'>; qty?: number }
  | { type: 'setQty'; variantId: string; qty: number }
  | { type: 'remove'; variantId: string }
  | { type: 'clear' }
  | { type: 'hydrate'; lines: CartLine[] }

const clampQty = (qty: number, maxQty: number) => Math.max(0, Math.min(Math.floor(qty), maxQty, MAX_QTY_PER_LINE))

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      if (action.line.maxQty <= 0) return state
      const existing = state.lines.find((l) => l.variantId === action.line.variantId)
      const wanted = (existing?.qty ?? 0) + (action.qty ?? 1)
      const next: CartLine = { ...action.line, qty: clampQty(wanted, action.line.maxQty) }
      const lines = existing
        ? state.lines.map((l) => (l.variantId === next.variantId ? next : l))
        : [...state.lines, next]
      return { ...state, lines }
    }
    case 'setQty': {
      const lines = state.lines
        .map((l) => (l.variantId === action.variantId ? { ...l, qty: clampQty(action.qty, l.maxQty) } : l))
        .filter((l) => l.qty > 0)
      return { ...state, lines }
    }
    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.variantId !== action.variantId) }
    case 'clear':
      return { ...state, lines: [] }
    case 'hydrate':
      return { lines: action.lines, hydrated: true }
  }
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0)
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty * l.priceCentavos, 0)

const storedLineSchema = z.object({
  variantId: z.string().min(1),
  productId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  size: z.enum(SIZES),
  priceCentavos: z.number().int().nonnegative(),
  image: z.string().nullable(),
  qty: z.number().int().positive(),
  maxQty: z.number().int().positive(),
})

export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  return data.flatMap((item) => {
    const parsed = storedLineSchema.safeParse(item)
    if (!parsed.success) return []
    const qty = clampQty(parsed.data.qty, parsed.data.maxQty)
    return qty > 0 ? [{ ...parsed.data, qty }] : []
  })
}
```

`src/lib/cart/totals.ts`:
```ts
export function computeTotals(subtotalCentavos: number, shippingFeeCentavos: number) {
  const shipping = subtotalCentavos > 0 ? shippingFeeCentavos : 0
  return { subtotal: subtotalCentavos, shipping, total: subtotalCentavos + shipping }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/cart`
Expected: PASS.

- [ ] **Step 5: Write failing provider test**

`src/components/cart/cart-provider.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CART_STORAGE_KEY } from '@/lib/cart/cart'
import { CartProvider, useCart } from './cart-provider'

const tee = { variantId: 'v-m', productId: 'p1', slug: 'tee', name: 'Tee', size: 'M' as const, priceCentavos: 50000, image: null, maxQty: 3 }

function Probe() {
  const { count, hydrated, dispatch } = useCart()
  return (
    <>
      <span data-testid="count">{hydrated ? count : 'loading'}</span>
      <button onClick={() => dispatch({ type: 'add', line: tee })}>add</button>
    </>
  )
}

const renderCart = () => render(<CartProvider><Probe /></CartProvider>)

describe('CartProvider', () => {
  it('restores the cart from localStorage', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ ...tee, qty: 2 }]))
    renderCart()
    expect(await screen.findByText('2')).toBeInTheDocument()
  })
  it('treats corrupted storage as an empty cart', async () => {
    localStorage.setItem(CART_STORAGE_KEY, '{oops')
    renderCart()
    expect(await screen.findByText('0')).toBeInTheDocument()
  })
  it('persists changes', async () => {
    renderCart()
    await screen.findByText('0')
    await userEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toHaveLength(1)
  })
})
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -- src/components/cart`
Expected: FAIL. `./cart-provider` doesn't exist yet.

- [ ] **Step 7: Implement provider, header, footer and shop layout**

`src/components/cart/cart-provider.tsx`:
```tsx
'use client'

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { CART_STORAGE_KEY, cartCount, cartReducer, cartSubtotal, EMPTY_CART, parseStoredCart, type CartAction, type CartLine } from '@/lib/cart/cart'

type CartContextValue = {
  lines: CartLine[]
  count: number
  subtotal: number
  hydrated: boolean
  dispatch: (action: CartAction) => void
}

const CartContext = createContext<CartContextValue | null>(null)

function readStorage(): string | null {
  try {
    return localStorage.getItem(CART_STORAGE_KEY)
  } catch {
    return null // private mode or blocked storage
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART)

  useEffect(() => {
    dispatch({ type: 'hydrate', lines: parseStoredCart(readStorage()) })
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) dispatch({ type: 'hydrate', lines: parseStoredCart(e.newValue) })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!state.hydrated) return
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.lines))
    } catch {
      // Storage unavailable; the cart still works for this page view.
    }
  }, [state])

  const value = useMemo<CartContextValue>(
    () => ({ lines: state.lines, count: cartCount(state.lines), subtotal: cartSubtotal(state.lines), hydrated: state.hydrated, dispatch }),
    [state],
  )
  return <CartContext value={value}>{children}</CartContext>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
```

`src/components/cart/cart-link.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useCart } from './cart-provider'

export function CartLink() {
  const { count, hydrated } = useCart()
  const shown = hydrated ? count : 0
  return (
    <Link href="/cart" aria-label={`Cart, ${shown} ${shown === 1 ? 'item' : 'items'}`} className="flex h-11 items-center gap-2 px-3 text-sm font-semibold uppercase">
      Cart
      <span className="inline-flex h-6 min-w-6 items-center justify-center border border-ink bg-tag px-1 text-xs font-bold text-ink">{shown}</span>
    </Link>
  )
}
```

`src/components/ui/styles.ts`:
```ts
export const buttonPrimary =
  'inline-flex h-12 items-center justify-center gap-2 border border-ink bg-tag px-6 font-display text-sm text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:border-muted disabled:bg-paper disabled:text-muted'
export const buttonSecondary =
  'inline-flex h-12 items-center justify-center gap-2 border border-ink bg-card px-6 font-display text-sm text-ink transition-colors hover:bg-ink hover:text-paper'
export const inputBase =
  'h-12 w-full border border-ink bg-card px-3 text-base text-ink placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-tag aria-invalid:border-tag'
```

`src/components/layout/site-header.tsx`:
```tsx
import Link from 'next/link'
import { CartLink } from '@/components/cart/cart-link'
import { SHIPPING_FEE_CENTAVOS } from '@/lib/config'
import { formatPeso } from '@/lib/money'

export function SiteHeader() {
  return (
    <>
      <div className="bg-ink px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-paper">
        Flat {formatPeso(SHIPPING_FEE_CENTAVOS)} shipping nationwide · New drop every Friday
      </div>
      <header className="sticky top-0 z-30 border-b border-ink bg-paper">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-display text-sm sm:text-base">The Overruns Project</Link>
          <nav className="flex items-center">
            <Link href="/shop" className="flex h-11 items-center px-3 text-sm font-semibold uppercase">Shop</Link>
            <CartLink />
          </nav>
        </div>
      </header>
    </>
  )
}
```

`src/components/layout/site-footer.tsx`:
```tsx
import Link from 'next/link'
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '@/lib/config'

const links = [
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/about#faq', label: 'FAQ' },
  { href: '/about#shipping', label: 'Shipping' },
  { href: INSTAGRAM_URL, label: 'Contact' },
]

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink bg-paper">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <p className="font-display text-lg">The Overruns Project</p>
        <ul className="grid grid-cols-2 gap-2 text-sm sm:flex sm:gap-6">
          {links.map((l) => (
            <li key={l.label}><Link href={l.href} className="inline-flex h-11 items-center underline-offset-4 hover:underline">{l.label}</Link></li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          <a href={INSTAGRAM_URL} className="underline">@{INSTAGRAM_HANDLE}</a> · Authentic overruns, limited stock.
        </p>
      </div>
    </footer>
  )
}
```

`src/app/(shop)/layout.tsx`:
```tsx
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl">{children}</main>
      <SiteFooter />
    </>
  )
}
```

In `src/app/layout.tsx`, wrap `{children}` with `<CartProvider>` (import from `@/components/cart/cart-provider`).

Move the temporary `src/app/page.tsx` to `src/app/(shop)/page.tsx` (`git mv`) so it picks up the header.

- [ ] **Step 8: Run tests, typecheck, and look at it**

Run: `npm test && npm run typecheck`
Expected: PASS.
Run: `npm run dev`. Open http://localhost:3000 at 375px width. Expected: the announcement bar, the sticky header with "Cart 0", and the footer, in the right colors and fonts.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(cart): localStorage cart reducer, provider and site chrome"
```

---

### Task 5: Catalog pages (Home, Shop, Product, About)

**Files:**
- Create: `src/lib/catalog/stock.ts`, `src/components/catalog/{price-tag.tsx,overrun-badge.tsx,product-card.tsx,product-grid.tsx,category-chips.tsx,shop-filters.tsx,product-gallery.tsx,size-picker.tsx,add-to-cart.tsx}`
- Create/replace: `src/app/(shop)/page.tsx`, `src/app/(shop)/shop/page.tsx`, `src/app/(shop)/product/[slug]/page.tsx`, `src/app/(shop)/about/page.tsx`, `src/app/not-found.tsx`
- Test: `src/lib/catalog/stock.test.ts`, `src/components/catalog/{price-tag.test.tsx,product-card.test.tsx,add-to-cart.test.tsx}`

**Interfaces:**
- Consumes: `Product`, `Variant`, queries, `createPublicClient`, `productImageUrl`, `sizeLabel` (Task 3); `useCart`, button styles (Task 4); `formatPeso` (Task 1).
- Produces: `LOW_STOCK_THRESHOLD = 3`, `totalStock(p: Product): number`, `lowStockLabel(stock: number): string | null`, `sizeStockNote(v: Variant): string | null`; `<PriceTag price retail size?>`, `<ProductCard product>`, `<ProductGrid products>`, `<AddToCart product>`.

- [ ] **Step 1: Write failing tests**

`src/lib/catalog/stock.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { lowStockLabel, sizeStockNote, totalStock } from './stock'
import type { Product } from './types'

const product = { variants: [{ id: 'a', size: 'S', stock: 1 }, { id: 'b', size: 'M', stock: 2 }] } as Product

describe('stock helpers', () => {
  it('sums stock across sizes', () => expect(totalStock(product)).toBe(3))
  it('labels low stock only between 1 and 3', () => {
    expect(lowStockLabel(0)).toBeNull()
    expect(lowStockLabel(3)).toBe('Only 3 left')
    expect(lowStockLabel(4)).toBeNull()
  })
  it('notes low stock per size', () => {
    expect(sizeStockNote({ id: 'b', size: 'M', stock: 2 })).toBe('Only 2 left in M')
    expect(sizeStockNote({ id: 'c', size: 'OS', stock: 1 })).toBe('Only 1 left')
    expect(sizeStockNote({ id: 'd', size: 'L', stock: 9 })).toBeNull()
  })
})
```

`src/components/catalog/price-tag.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PriceTag } from './price-tag'

describe('PriceTag', () => {
  it('strikes through the retail price and bolds the overrun price', () => {
    const { container } = render(<PriceTag price={69000} retail={189900} />)
    expect(container.querySelector('s')).toHaveTextContent('₱1,899')
    expect(container).toHaveTextContent('Overrun price ₱690')
  })
  it('omits the strike-through without a retail price', () => {
    const { container } = render(<PriceTag price={69000} retail={null} />)
    expect(container.querySelector('s')).toBeNull()
  })
})
```

`src/components/catalog/product-card.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Product } from '@/lib/catalog/types'
import { ProductCard } from './product-card'

const base: Product = {
  id: 'p1', slug: 'coach-jacket', name: 'Coach Jacket', description: '', category: 'outerwear',
  priceCentavos: 149000, retailPriceCentavos: 429900, images: ['https://picsum.photos/seed/x/800/800'],
  isActive: true, isFeatured: false, createdAt: '2026-10-01T00:00:00Z',
  variants: [{ id: 'v1', size: 'M', stock: 2 }, { id: 'v2', size: 'L', stock: 1 }],
}

describe('ProductCard', () => {
  it('links to the product and shows low stock', () => {
    render(<ProductCard product={base} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/product/coach-jacket')
    expect(screen.getByText('Only 3 left')).toBeInTheDocument()
  })
  it('shows a sold-out overlay when no size has stock', () => {
    render(<ProductCard product={{ ...base, variants: [{ id: 'v1', size: 'M', stock: 0 }] }} />)
    expect(screen.getByText('Sold out')).toBeInTheDocument()
    expect(screen.queryByText(/Only \d left/)).toBeNull()
  })
})
```

`src/components/catalog/add-to-cart.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CartProvider, useCart } from '@/components/cart/cart-provider'
import type { Product } from '@/lib/catalog/types'
import { AddToCart } from './add-to-cart'

const product: Product = {
  id: 'p1', slug: 'oxford', name: 'Oxford', description: '', category: 'tops',
  priceCentavos: 69000, retailPriceCentavos: 189900, images: [], isActive: true, isFeatured: false,
  createdAt: '2026-10-01T00:00:00Z',
  variants: [{ id: 'v-s', size: 'S', stock: 0 }, { id: 'v-m', size: 'M', stock: 2 }],
}

function Count() {
  const { count, hydrated } = useCart()
  return <output aria-label="count">{hydrated ? count : '-'}</output>
}

const setup = (p = product) => render(<CartProvider><AddToCart product={p} /><Count /></CartProvider>)

describe('AddToCart', () => {
  it('cannot add a sold-out size', async () => {
    setup()
    const sold = screen.getByRole('button', { name: /S \(sold out\)/ })
    expect(sold).toBeDisabled()
    await userEvent.click(sold)
    expect(screen.getByRole('button', { name: 'Select a size' })).toBeDisabled()
    expect(screen.getByLabelText('count')).toHaveTextContent('0')
  })
  it('adds an in-stock size and shows the low-stock note', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'M' }))
    expect(screen.getByText('Only 2 left in M')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))
    expect(screen.getByLabelText('count')).toHaveTextContent('1')
    expect(screen.getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart')
  })
  it('shows a disabled Sold out button when nothing is in stock', () => {
    setup({ ...product, variants: [{ id: 'v-s', size: 'S', stock: 0 }] })
    expect(screen.getByRole('button', { name: 'Sold out' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/catalog/stock src/components/catalog`
Expected: FAIL. The modules don't exist yet.

- [ ] **Step 3: Implement stock helpers and components**

`src/lib/catalog/stock.ts`:
```ts
import type { Product, Variant } from './types'

export const LOW_STOCK_THRESHOLD = 3

export const totalStock = (p: Product) => p.variants.reduce((n, v) => n + v.stock, 0)

export function lowStockLabel(stock: number): string | null {
  return stock > 0 && stock <= LOW_STOCK_THRESHOLD ? `Only ${stock} left` : null
}

export function sizeStockNote(v: Variant): string | null {
  const label = lowStockLabel(v.stock)
  if (!label) return null
  return v.size === 'OS' ? label : `${label} in ${v.size}`
}
```

`src/components/catalog/price-tag.tsx`:
```tsx
import { formatPeso } from '@/lib/money'

export function PriceTag({ price, retail, size = 'sm' }: { price: number; retail: number | null; size?: 'sm' | 'lg' }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      {retail ? (
        <s className={size === 'lg' ? 'text-base text-muted' : 'text-sm text-muted'}>
          <span className="sr-only">Retail price </span>{formatPeso(retail)}
        </s>
      ) : null}
      <span className={size === 'lg' ? 'text-2xl font-bold' : 'text-base font-bold'}>
        <span className="sr-only">Overrun price </span>{formatPeso(price)}
      </span>
    </p>
  )
}
```

`src/components/catalog/overrun-badge.tsx`:
```tsx
// Hang-tag shape: a pointed left edge with a punched hole.
export function OverrunBadge({ className = '', label = 'Overrun' }: { className?: string; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 bg-tag py-1 pl-4 pr-2 font-display text-[10px] text-ink [clip-path:polygon(10px_0,100%_0,100%_100%,10px_100%,0_50%)] ${className}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-paper" />
      {label}
    </span>
  )
}
```

`src/components/catalog/product-card.tsx`:
```tsx
import Image from 'next/image'
import Link from 'next/link'
import { productImageUrl } from '@/lib/catalog/images'
import { lowStockLabel, totalStock } from '@/lib/catalog/stock'
import type { Product } from '@/lib/catalog/types'
import { OverrunBadge } from './overrun-badge'
import { PriceTag } from './price-tag'

export function ProductCard({ product }: { product: Product }) {
  const stock = totalStock(product)
  const soldOut = stock === 0
  const low = lowStockLabel(stock)
  const cover = product.images[0]
  return (
    <Link href={`/product/${product.slug}`} className="group block border border-ink bg-card">
      <div className="relative aspect-square overflow-hidden border-b border-ink bg-paper">
        {cover ? (
          <Image src={productImageUrl(cover)} alt={product.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform group-hover:scale-[1.02]" />
        ) : null}
        <OverrunBadge className="absolute left-0 top-3" />
        {soldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-paper/70">
            <span className="border border-ink bg-card px-3 py-1 font-display text-xs">Sold out</span>
          </div>
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <h3 className="text-sm leading-snug">{product.name}</h3>
        <PriceTag price={product.priceCentavos} retail={product.retailPriceCentavos} />
        {!soldOut && low ? <p className="inline-block bg-tag px-1.5 text-[11px] font-bold uppercase text-ink">{low}</p> : null}
      </div>
    </Link>
  )
}
```

`src/components/catalog/product-grid.tsx`:
```tsx
import type { Product } from '@/lib/catalog/types'
import { ProductCard } from './product-card'

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) return <p className="px-4 py-10 text-center text-muted">No products match. Try another size or category.</p>
  return (
    <ul className="grid grid-cols-2 gap-3 px-4 lg:grid-cols-4">
      {products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
    </ul>
  )
}
```

`src/components/catalog/category-chips.tsx`:
```tsx
import Link from 'next/link'
import { CATEGORIES } from '@/lib/catalog/constants'

export function CategoryChips() {
  return (
    <nav aria-label="Categories" className="flex gap-2 overflow-x-auto px-4 py-4 [scrollbar-width:none]">
      {CATEGORIES.map((c) => (
        <Link key={c.slug} href={`/shop?category=${c.slug}`} className="inline-flex h-11 shrink-0 items-center border border-ink bg-card px-4 text-sm font-semibold uppercase hover:bg-ink hover:text-paper">
          {c.label}
        </Link>
      ))}
    </nav>
  )
}
```

`src/components/catalog/shop-filters.tsx`:
```tsx
'use client'

import Form from 'next/form'
import { CATEGORIES, SIZES, sizeLabel } from '@/lib/catalog/constants'
import type { ShopFilters as Filters } from '@/lib/catalog/params'

const select = 'h-11 w-full border border-ink bg-card px-2 text-sm'

export function ShopFilters({ filters }: { filters: Filters }) {
  return (
    <Form action="/shop" onChange={(e) => e.currentTarget.requestSubmit()} className="sticky top-14 z-20 grid grid-cols-3 gap-2 border-b border-ink bg-paper px-4 py-3">
      <label className="sr-only" htmlFor="f-category">Category</label>
      <select id="f-category" name="category" defaultValue={filters.category ?? ''} className={select}>
        <option value="">All categories</option>
        {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>
      <label className="sr-only" htmlFor="f-size">Size</label>
      <select id="f-size" name="size" defaultValue={filters.size ?? ''} className={select}>
        <option value="">All sizes</option>
        {SIZES.map((s) => <option key={s} value={s}>{sizeLabel(s)}</option>)}
      </select>
      <label className="sr-only" htmlFor="f-sort">Sort</label>
      <select id="f-sort" name="sort" defaultValue={filters.sort} className={select}>
        <option value="newest">Newest</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>
      <noscript><button type="submit" className="col-span-3 h-11 border border-ink">Apply</button></noscript>
    </Form>
  )
}
```

`src/components/catalog/product-gallery.tsx`:
```tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'
import { productImageUrl } from '@/lib/catalog/images'

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0)
  if (images.length === 0) return <div className="aspect-square border border-ink bg-card" />
  return (
    <div>
      <div
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto border border-ink bg-card [scrollbar-width:none]"
      >
        {images.map((src, i) => (
          <div key={src} className="relative aspect-square w-full shrink-0 snap-center">
            <Image src={productImageUrl(src)} alt={`${name}, photo ${i + 1} of ${images.length}`} fill priority={i === 0} sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        ))}
      </div>
      {images.length > 1 ? (
        <div aria-hidden className="mt-3 flex justify-center gap-2">
          {images.map((src, i) => <span key={src} className={`h-2 w-2 rounded-full ${i === index ? 'bg-ink' : 'bg-muted/40'}`} />)}
        </div>
      ) : null}
    </div>
  )
}
```

`src/components/catalog/size-picker.tsx`:
```tsx
'use client'

import { sizeLabel } from '@/lib/catalog/constants'
import type { Variant } from '@/lib/catalog/types'

export function SizePicker({ variants, selected, onSelect }: { variants: Variant[]; selected: string | null; onSelect: (variantId: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide">Size</legend>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const soldOut = v.stock <= 0
          const isSelected = selected === v.id
          return (
            <button
              key={v.id}
              type="button"
              disabled={soldOut}
              aria-pressed={isSelected}
              onClick={() => onSelect(v.id)}
              className={`h-11 min-w-12 border px-3 text-sm font-semibold ${
                soldOut ? 'cursor-not-allowed border-muted/50 bg-paper text-muted' : isSelected ? 'border-ink bg-ink text-paper' : 'border-ink bg-card hover:bg-paper'
              }`}
            >
              {soldOut ? <s>{sizeLabel(v.size)}</s> : sizeLabel(v.size)}
              {soldOut ? <span className="sr-only"> (sold out)</span> : null}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
```

`src/components/catalog/add-to-cart.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/components/cart/cart-provider'
import { buttonPrimary } from '@/components/ui/styles'
import { sizeStockNote } from '@/lib/catalog/stock'
import type { Product } from '@/lib/catalog/types'
import { SizePicker } from './size-picker'

export function AddToCart({ product }: { product: Product }) {
  const { dispatch } = useCart()
  const inStock = product.variants.filter((v) => v.stock > 0)
  const onlyOne = product.variants.length === 1 && inStock.length === 1
  const [variantId, setVariantId] = useState<string | null>(onlyOne ? inStock[0].id : null)
  const [added, setAdded] = useState(false)
  const variant = product.variants.find((v) => v.id === variantId && v.stock > 0) ?? null
  const note = variant ? sizeStockNote(variant) : null

  function add() {
    if (!variant) return
    dispatch({
      type: 'add',
      line: {
        variantId: variant.id, productId: product.id, slug: product.slug, name: product.name, size: variant.size,
        priceCentavos: product.priceCentavos, image: product.images[0] ?? null, maxQty: variant.stock,
      },
    })
    setAdded(true)
  }

  return (
    <div className="space-y-4">
      <SizePicker variants={product.variants} selected={variantId} onSelect={(id) => { setVariantId(id); setAdded(false) }} />
      {note ? <p className="text-sm font-semibold">{note}</p> : null}
      <div className="fixed inset-x-0 bottom-0 z-20 space-y-2 border-t border-ink bg-paper p-4 sm:static sm:border-0 sm:p-0">
        {inStock.length === 0 ? (
          <button type="button" disabled className={`${buttonPrimary} w-full`}>Sold out</button>
        ) : (
          <button type="button" onClick={add} disabled={!variant} className={`${buttonPrimary} w-full`}>
            {variant ? 'Add to cart' : 'Select a size'}
          </button>
        )}
        {added ? (
          <p role="status" className="text-center text-sm">
            Added to cart. <Link href="/cart" className="font-semibold underline">View cart</Link>
          </p>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/catalog src/components/catalog`
Expected: PASS.

- [ ] **Step 5: Pages**

`src/app/(shop)/page.tsx`:
```tsx
import Image from 'next/image'
import Link from 'next/link'
import { CategoryChips } from '@/components/catalog/category-chips'
import { ProductGrid } from '@/components/catalog/product-grid'
import { buttonPrimary } from '@/components/ui/styles'
import { listFeatured, listLatest } from '@/lib/catalog/queries'
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '@/lib/config'
import { createPublicClient } from '@/lib/supabase/public'

export const revalidate = 60

export default async function HomePage() {
  const db = createPublicClient()
  const [latest, featured] = await Promise.all([listLatest(db, 6), listFeatured(db, 4)])
  return (
    <>
      <section className="relative border-b border-ink">
        <div className="relative aspect-[4/5] sm:aspect-[16/7]">
          <Image src="https://picsum.photos/seed/overruns-warehouse/1600/1000" alt="Folded clothing on a warehouse shelf" fill priority sizes="100vw" className="object-cover" />
        </div>
        <div className="absolute inset-x-0 bottom-0 space-y-4 bg-gradient-to-t from-ink/80 to-transparent p-4 pt-24 text-paper sm:p-8">
          <h1 className="font-display text-4xl leading-none sm:text-6xl">Real brands.<br />Overrun prices.</h1>
          <Link href="/shop" className={buttonPrimary}>Shop the drop</Link>
        </div>
      </section>

      <CategoryChips />

      <section className="space-y-4 py-4">
        <h2 className="px-4 font-display text-xl">Latest drop</h2>
        <ProductGrid products={latest} />
      </section>

      {featured.length > 0 ? (
        <section className="space-y-4 py-4">
          <h2 className="px-4 font-display text-xl">Featured</h2>
          <ProductGrid products={featured} />
        </section>
      ) : null}

      <section className="mx-4 my-8 space-y-2 border border-ink bg-card p-6">
        <h2 className="font-display text-lg">What&apos;s an overrun?</h2>
        <p className="text-muted">Factories make extra pieces to cover defects and delays. The extras that pass QC are authentic, brand-new items we sell below retail.</p>
        <Link href="/about" className="inline-flex h-11 items-center font-semibold underline">Learn more</Link>
      </section>

      <section className="px-4 py-4 text-center">
        <a href={INSTAGRAM_URL} className="inline-flex h-11 items-center font-display text-sm underline">Follow @{INSTAGRAM_HANDLE}</a>
      </section>
    </>
  )
}
```

`src/app/(shop)/shop/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { ProductGrid } from '@/components/catalog/product-grid'
import { ShopFilters } from '@/components/catalog/shop-filters'
import { parseShopParams } from '@/lib/catalog/params'
import { listProducts } from '@/lib/catalog/queries'
import { createPublicClient } from '@/lib/supabase/public'

export const metadata: Metadata = { title: 'Shop' }

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseShopParams(await searchParams)
  const products = await listProducts(createPublicClient(), filters)
  return (
    <>
      <h1 className="px-4 pb-2 pt-6 font-display text-2xl">Shop</h1>
      <ShopFilters filters={filters} />
      <p className="px-4 py-3 text-sm text-muted">{products.length} {products.length === 1 ? 'item' : 'items'}</p>
      <ProductGrid products={products} />
    </>
  )
}
```

`src/app/(shop)/product/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AddToCart } from '@/components/catalog/add-to-cart'
import { OverrunBadge } from '@/components/catalog/overrun-badge'
import { PriceTag } from '@/components/catalog/price-tag'
import { ProductGallery } from '@/components/catalog/product-gallery'
import { getProductBySlug } from '@/lib/catalog/queries'
import { SHIPPING_FEE_CENTAVOS } from '@/lib/config'
import { formatPeso } from '@/lib/money'
import { createPublicClient } from '@/lib/supabase/public'

export const revalidate = 60
type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug(createPublicClient(), (await params).slug)
  return { title: product?.name ?? 'Product not found' }
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug(createPublicClient(), (await params).slug)
  if (!product) notFound()
  return (
    <div className="grid gap-6 px-4 pb-32 pt-4 sm:grid-cols-2 sm:pb-12">
      <ProductGallery images={product.images} name={product.name} />
      <div className="space-y-5">
        <OverrunBadge label="Limited stock" />
        <h1 className="font-display text-2xl leading-tight">{product.name}</h1>
        <PriceTag price={product.priceCentavos} retail={product.retailPriceCentavos} size="lg" />
        <AddToCart product={product} />
        <div className="divide-y divide-ink border-y border-ink">
          <details open className="py-3"><summary className="cursor-pointer font-semibold uppercase">Details</summary><p className="pt-2 text-muted">{product.description}</p></details>
          <details className="py-3"><summary className="cursor-pointer font-semibold uppercase">Sizing</summary><p className="pt-2 text-muted">Overruns follow the brand&apos;s own sizing. Message us on Instagram for measurements.</p></details>
          <details className="py-3"><summary className="cursor-pointer font-semibold uppercase">Shipping</summary><p className="pt-2 text-muted">Flat {formatPeso(SHIPPING_FEE_CENTAVOS)} nationwide. Ships within 2 business days of payment.</p></details>
        </div>
      </div>
    </div>
  )
}
```

`src/app/(shop)/about/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { SHIPPING_FEE_CENTAVOS } from '@/lib/config'
import { formatPeso } from '@/lib/money'

export const metadata: Metadata = { title: 'About' }

export default function AboutPage() {
  return (
    <article className="max-w-2xl space-y-6 px-4 py-8">
      <h1 className="font-display text-3xl">About the project</h1>
      <p>The Overruns Project sells authentic branded clothing from factory overruns: the extra pieces a factory makes beyond a brand&apos;s order. They&apos;re brand-new, pass the same quality checks, and cost a fraction of retail.</p>
      <h2 id="faq" className="font-display text-xl">Are they real?</h2>
      <p>Yes. Overruns come off the same lines as retail stock. Labels may be cut or marked to separate them from retail inventory.</p>
      <h2 className="font-display text-xl">Why limited sizes?</h2>
      <p>Each run leaves an uneven mix of sizes. When a size is gone, it&apos;s usually gone for good.</p>
      <h2 id="shipping" className="font-display text-xl">Shipping</h2>
      <p>Flat {formatPeso(SHIPPING_FEE_CENTAVOS)} anywhere in the Philippines. Orders ship within 2 business days after payment.</p>
    </article>
  )
}
```

`src/app/not-found.tsx`:
```tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-20 text-center">
      <h1 className="font-display text-2xl">Not found</h1>
      <p className="text-muted">This item may have sold out or been removed.</p>
      <Link href="/shop" className="font-semibold underline">Back to the shop</Link>
    </main>
  )
}
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev` (with local Supabase running). At 375px width:
- `/` shows the hero, chips, "Latest drop" grid with struck-through prices, and the Featured section.
- `/shop?category=tops&size=M` filters correctly. Changing a select reloads the results.
- `/product/crewneck-sweatshirt-grey` shows all sizes crossed out and a disabled "Sold out" button.
- `/product/oxford-button-down-white`: XL is crossed out, M shows "Only 3 left in M", and "Add to cart" bumps the header count.
- `/product/nope` shows the not-found page.

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(catalog): home, shop, product and about pages with size-aware add to cart"
```

---

### Task 6: Cart page

**Files:**
- Create: `src/components/cart/cart-view.tsx`, `src/app/(shop)/cart/page.tsx`
- Test: `src/components/cart/cart-view.test.tsx`

**Interfaces:**
- Consumes: `useCart`, `computeTotals`, `MAX_QTY_PER_LINE`, `SHIPPING_FEE_CENTAVOS`, `productImageUrl`, `sizeLabel`, `formatPeso`, button styles.
- Produces: `<CartView cancelled: boolean>`.

- [ ] **Step 1: Write the failing test**

`src/components/cart/cart-view.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CART_STORAGE_KEY } from '@/lib/cart/cart'
import { CartProvider } from './cart-provider'
import { CartView } from './cart-view'

const line = { variantId: 'v-m', productId: 'p1', slug: 'tee', name: 'Heavyweight Tee', size: 'M', priceCentavos: 45000, image: null, qty: 1, maxQty: 2 }
const setup = (cancelled = false) => render(<CartProvider><CartView cancelled={cancelled} /></CartProvider>)

describe('CartView', () => {
  it('shows an empty state', async () => {
    setup()
    expect(await screen.findByText('Your cart is empty.')).toBeInTheDocument()
  })
  it('shows subtotal, flat shipping and total, and caps quantity at stock', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line]))
    setup()
    expect(await screen.findByText('Heavyweight Tee')).toBeInTheDocument()
    expect(screen.getByTestId('subtotal')).toHaveTextContent('₱450')
    expect(screen.getByTestId('shipping')).toHaveTextContent('₱150')
    expect(screen.getByTestId('total')).toHaveTextContent('₱600')
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    expect(screen.getByTestId('total')).toHaveTextContent('₱1,050')
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/checkout')
  })
  it('keeps the cart and explains when payment was cancelled', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line]))
    setup(true)
    expect(await screen.findByRole('status')).toHaveTextContent('Payment was cancelled')
    expect(screen.getByText('Heavyweight Tee')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- cart-view`
Expected: FAIL. `./cart-view` doesn't exist yet.

- [ ] **Step 3: Implement**

`src/components/cart/cart-view.tsx`:
```tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { buttonPrimary } from '@/components/ui/styles'
import { MAX_QTY_PER_LINE } from '@/lib/cart/cart'
import { computeTotals } from '@/lib/cart/totals'
import { sizeLabel } from '@/lib/catalog/constants'
import { productImageUrl } from '@/lib/catalog/images'
import { SHIPPING_FEE_CENTAVOS } from '@/lib/config'
import { formatPeso } from '@/lib/money'
import { useCart } from './cart-provider'

const stepBtn = 'flex h-11 w-11 items-center justify-center border border-ink text-lg disabled:border-muted/50 disabled:text-muted'

export function CartView({ cancelled }: { cancelled: boolean }) {
  const { lines, subtotal, hydrated, dispatch } = useCart()
  if (!hydrated) return <p className="px-4 py-10 text-muted">Loading cart…</p>
  const totals = computeTotals(subtotal, SHIPPING_FEE_CENTAVOS)

  return (
    <div className="space-y-6 px-4 py-6">
      <h1 className="font-display text-2xl">Your cart</h1>
      {cancelled ? (
        <p role="status" className="border border-ink bg-card p-3 text-sm">Payment was cancelled. Your cart is still here whenever you&apos;re ready.</p>
      ) : null}
      {lines.length === 0 ? (
        <div className="space-y-4 py-10 text-center">
          <p>Your cart is empty.</p>
          <Link href="/shop" className={buttonPrimary}>Shop the drop</Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-ink border-y border-ink">
            {lines.map((l) => (
              <li key={l.variantId} className="flex gap-3 py-4">
                <div className="relative h-24 w-24 shrink-0 border border-ink bg-card">
                  {l.image ? <Image src={productImageUrl(l.image)} alt="" fill sizes="96px" className="object-cover" /> : null}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex justify-between gap-2">
                    <Link href={`/product/${l.slug}`} className="font-semibold">{l.name}</Link>
                    <span className="font-bold">{formatPeso(l.priceCentavos * l.qty)}</span>
                  </div>
                  <p className="text-sm text-muted">Size {sizeLabel(l.size)} · {formatPeso(l.priceCentavos)} each</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <button type="button" aria-label="Decrease quantity" className={stepBtn} onClick={() => dispatch({ type: 'setQty', variantId: l.variantId, qty: l.qty - 1 })}>−</button>
                      <span className="w-10 text-center" aria-live="polite">{l.qty}</span>
                      <button type="button" aria-label="Increase quantity" className={stepBtn} disabled={l.qty >= Math.min(l.maxQty, MAX_QTY_PER_LINE)} onClick={() => dispatch({ type: 'setQty', variantId: l.variantId, qty: l.qty + 1 })}>+</button>
                    </div>
                    <button type="button" className="h-11 px-2 text-sm underline" onClick={() => dispatch({ type: 'remove', variantId: l.variantId })}>Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border border-ink bg-card p-4">
            <div className="flex justify-between"><dt>Subtotal</dt><dd data-testid="subtotal">{formatPeso(totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping (flat)</dt><dd data-testid="shipping">{formatPeso(totals.shipping)}</dd></div>
            <div className="flex justify-between border-t border-ink pt-2 text-lg font-bold"><dt>Total</dt><dd data-testid="total">{formatPeso(totals.total)}</dd></div>
          </dl>
          <Link href="/checkout" className={`${buttonPrimary} w-full`}>Checkout</Link>
        </>
      )}
    </div>
  )
}
```

`src/app/(shop)/cart/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { CartView } from '@/components/cart/cart-view'

export const metadata: Metadata = { title: 'Cart' }

export default async function CartPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams
  return <CartView cancelled={cancelled === '1'} />
}
```

- [ ] **Step 4: Run tests and check in the browser**

Run: `npm test && npm run typecheck`
Expected: PASS. In dev, add two items, change quantities, remove one, reload the page (the cart persists), and open `/cart?cancelled=1` (the banner shows).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cart): cart page with quantity stepper and flat shipping totals"
```

---

### Task 7: Checkout (validation, server re-pricing, pending order, PayMongo session)

**Files:**
- Create: `src/lib/checkout/{schema.ts,types.ts,price-cart.ts,problems.ts,start-checkout.ts,deps.ts}`, `src/lib/paymongo/client.ts`, `src/lib/orders/format.ts`
- Create: `src/app/(shop)/checkout/{page.tsx,actions.ts}`, `src/components/checkout/checkout-form.tsx`
- Modify: `src/lib/cart/cart.ts` (add the `applyProblems` action)
- Test: `src/lib/checkout/{schema.test.ts,price-cart.test.ts,problems.test.ts,start-checkout.test.ts}`, `src/lib/paymongo/client.test.ts`, `src/lib/orders/format.test.ts`, additions to `src/lib/cart/cart.test.ts`

**Interfaces:**
- Consumes: `computeTotals`, `CartState`, `cartReducer`, `MAX_QTY_PER_LINE` (Task 4); `createAdminClient` (Task 3); `siteUrl`, `SHIPPING_FEE_CENTAVOS` (Task 1).
- Produces:
  - `checkoutFormSchema`, `type CheckoutForm = { name; phone /* +639XXXXXXXXX */; email; street; barangay; city; province; zip }`, `type Address = { street; barangay; city; province; zip }`, `addressSchema`, `cartPayloadSchema`, `type CartPayloadLine = { variantId: string; qty: number; priceCentavos: number }`
  - `type CartProblem = { variantId: string; reason: 'unavailable' | 'insufficient_stock' | 'price_changed'; available: number; currentPriceCentavos?: number; name?: string; size?: Size }`
  - `type DbVariant = { id: string; size: Size; stock: number; product: { id: string; name: string; isActive: boolean; priceCentavos: number } }`
  - `type PricedLine = { variantId: string; productName: string; size: Size; qty: number; priceCentavos: number }`
  - `priceCart(requested, variants, shippingFeeCentavos): { ok: true; lines; subtotal; shipping; total } | { ok: false; problems }`
  - `problemMessage(p: CartProblem): string`
  - `CartAction` gains `{ type: 'applyProblems'; problems: CartProblem[] }`
  - `createCheckoutSession(input: CheckoutSessionInput, opts: { secretKey: string; fetchImpl?: typeof fetch }): Promise<{ id: string; checkoutUrl: string }>`, `PayMongoError`
  - `startCheckoutCore(form, cart, deps): Promise<StartCheckoutResult>`, `type StartCheckoutDeps`
  - `formatOrderNumber(id: string): string`, `formatManilaDate(iso: string): string`

- [ ] **Step 1: Write failing tests**

`src/lib/orders/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { formatManilaDate, formatOrderNumber } from './format'

describe('order formatting', () => {
  it('uses the first 8 chars of the id, upper-cased', () => {
    expect(formatOrderNumber('3f2a9c1e-0000-4000-8000-000000000000')).toBe('3F2A9C1E')
  })
  it('formats dates in Manila time', () => {
    expect(formatManilaDate('2026-10-15T16:30:00Z')).toBe('Oct 16, 2026, 12:30 AM')
  })
})
```

`src/lib/checkout/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { cartPayloadSchema, checkoutFormSchema } from './schema'

const valid = { name: 'Juan Dela Cruz', phone: '0917 123 4567', email: 'juan@example.com', street: '12 Mabini St', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '1210' }

describe('checkoutFormSchema', () => {
  it('normalizes PH mobile numbers to +63 format', () => {
    expect(checkoutFormSchema.parse(valid).phone).toBe('+639171234567')
    expect(checkoutFormSchema.parse({ ...valid, phone: '+63 917-123-4567' }).phone).toBe('+639171234567')
  })
  it('rejects bad phone, email and ZIP with readable messages', () => {
    const r = checkoutFormSchema.safeParse({ ...valid, phone: '12345', email: 'nope', zip: '12' })
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map((i) => i.path[0])
    expect(paths).toEqual(expect.arrayContaining(['phone', 'email', 'zip']))
  })
})

describe('cartPayloadSchema', () => {
  it('rejects an empty cart and silly quantities', () => {
    expect(cartPayloadSchema.safeParse([]).success).toBe(false)
    expect(cartPayloadSchema.safeParse([{ variantId: '00000000-0000-4000-8000-000000000001', qty: 0, priceCentavos: 100 }]).success).toBe(false)
    expect(cartPayloadSchema.safeParse([{ variantId: 'x', qty: 1, priceCentavos: 100 }]).success).toBe(false)
  })
})
```

`src/lib/checkout/price-cart.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { priceCart } from './price-cart'
import type { DbVariant } from './types'

const v = (over: Partial<DbVariant> = {}, product: Partial<DbVariant['product']> = {}): DbVariant => ({
  id: 'v1', size: 'M', stock: 3, ...over,
  product: { id: 'p1', name: 'Coach Jacket', isActive: true, priceCentavos: 149000, ...product },
})

describe('priceCart', () => {
  it('prices from the database and adds flat shipping', () => {
    const r = priceCart([{ variantId: 'v1', qty: 2, priceCentavos: 149000 }], [v()], 15000)
    expect(r).toEqual({
      ok: true,
      lines: [{ variantId: 'v1', productName: 'Coach Jacket', size: 'M', qty: 2, priceCentavos: 149000 }],
      subtotal: 298000, shipping: 15000, total: 313000,
    })
  })
  it('merges duplicate variant lines before checking stock', () => {
    const r = priceCart([{ variantId: 'v1', qty: 2, priceCentavos: 149000 }, { variantId: 'v1', qty: 2, priceCentavos: 149000 }], [v()], 15000)
    expect(r).toMatchObject({ ok: false, problems: [{ variantId: 'v1', reason: 'insufficient_stock', available: 3 }] })
  })
  it('flags missing, inactive and sold-out variants as unavailable', () => {
    const r = priceCart(
      [{ variantId: 'gone', qty: 1, priceCentavos: 1 }, { variantId: 'v1', qty: 1, priceCentavos: 149000 }, { variantId: 'v2', qty: 1, priceCentavos: 149000 }],
      [v({}, { isActive: false }), v({ id: 'v2', stock: 0 })],
      15000,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problems.map((p) => [p.variantId, p.reason])).toEqual([['gone', 'unavailable'], ['v1', 'unavailable'], ['v2', 'unavailable']])
  })
  it('flags a price change instead of silently charging the new price', () => {
    const r = priceCart([{ variantId: 'v1', qty: 1, priceCentavos: 99000 }], [v()], 15000)
    expect(r).toMatchObject({ ok: false, problems: [{ reason: 'price_changed', currentPriceCentavos: 149000 }] })
  })
})
```

`src/lib/checkout/problems.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { cartReducer, type CartLine } from '@/lib/cart/cart'
import { problemMessage } from './problems'

const line = (over: Partial<CartLine>): CartLine => ({ variantId: 'v1', productId: 'p', slug: 's', name: 'Coach Jacket', size: 'M', priceCentavos: 99000, image: null, qty: 3, maxQty: 5, ...over })

describe('applyProblems', () => {
  it('removes unavailable lines, lowers qty to what is left, and updates prices', () => {
    const state = { hydrated: true, lines: [line({ variantId: 'gone' }), line({ variantId: 'low' }), line({ variantId: 'price' })] }
    const next = cartReducer(state, {
      type: 'applyProblems',
      problems: [
        { variantId: 'gone', reason: 'unavailable', available: 0 },
        { variantId: 'low', reason: 'insufficient_stock', available: 1 },
        { variantId: 'price', reason: 'price_changed', available: 5, currentPriceCentavos: 149000 },
      ],
    })
    expect(next.lines.map((l) => [l.variantId, l.qty, l.maxQty, l.priceCentavos])).toEqual([
      ['low', 1, 1, 99000],
      ['price', 3, 5, 149000],
    ])
  })
})

describe('problemMessage', () => {
  it('explains each problem in plain words', () => {
    expect(problemMessage({ variantId: 'a', reason: 'unavailable', available: 0, name: 'Coach Jacket', size: 'M' })).toBe('Coach Jacket (M) is sold out.')
    expect(problemMessage({ variantId: 'a', reason: 'insufficient_stock', available: 1, name: 'Coach Jacket', size: 'M' })).toBe('Only 1 left of Coach Jacket (M).')
    expect(problemMessage({ variantId: 'a', reason: 'price_changed', available: 2, currentPriceCentavos: 149000, name: 'Coach Jacket', size: 'M' })).toBe('Coach Jacket (M) is now ₱1,490.')
    expect(problemMessage({ variantId: 'a', reason: 'unavailable', available: 0 })).toBe('An item in your cart is no longer available.')
  })
})
```

`src/lib/paymongo/client.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { createCheckoutSession, PayMongoError } from './client'

const input = {
  orderId: '3f2a9c1e-0000-4000-8000-000000000000',
  lines: [{ variantId: 'v1', productName: 'Coach Jacket', size: 'M' as const, qty: 2, priceCentavos: 149000 }],
  shippingCentavos: 15000,
  customer: { name: 'Juan', email: 'juan@example.com', phone: '+639171234567' },
  successUrl: 'https://shop.test/order/3f2a',
  cancelUrl: 'https://shop.test/cart?cancelled=1',
  paymentMethods: ['card', 'gcash', 'paymaya', 'qrph'],
}

describe('createCheckoutSession', () => {
  it('posts line items in centavos with basic auth and returns the session', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'cs_123', attributes: { checkout_url: 'https://checkout.paymongo.com/cs_123' } } }), { status: 200 }))
    const result = await createCheckoutSession(input, { secretKey: 'sk_test_abc', fetchImpl })
    expect(result).toEqual({ id: 'cs_123', checkoutUrl: 'https://checkout.paymongo.com/cs_123' })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.paymongo.com/v1/checkout_sessions')
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('sk_test_abc:').toString('base64')}`)
    const attrs = JSON.parse(init.body).data.attributes
    expect(attrs.line_items).toEqual([
      { currency: 'PHP', amount: 149000, name: 'Coach Jacket (M)', quantity: 2 },
      { currency: 'PHP', amount: 15000, name: 'Shipping (flat rate)', quantity: 1 },
    ])
    expect(attrs.payment_method_types).toEqual(['card', 'gcash', 'paymaya', 'qrph'])
    expect(attrs.reference_number).toBe(input.orderId)
    expect(attrs.metadata).toEqual({ order_id: input.orderId })
    expect(attrs.cancel_url).toBe(input.cancelUrl)
  })
  it('throws PayMongoError with the response body on failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ detail: 'bad key' }] }), { status: 401 }))
    await expect(createCheckoutSession(input, { secretKey: 'bad', fetchImpl })).rejects.toBeInstanceOf(PayMongoError)
  })
})
```

`src/lib/checkout/start-checkout.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { startCheckoutCore, type StartCheckoutDeps } from './start-checkout'

const form = { name: 'Juan', phone: '+639171234567', email: 'juan@example.com', street: '12 Mabini', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '1210' }
const variant = { id: '00000000-0000-4000-8000-000000000001', size: 'M' as const, stock: 2, product: { id: 'p1', name: 'Tee', isActive: true, priceCentavos: 45000 } }
const cart = [{ variantId: variant.id, qty: 1, priceCentavos: 45000 }]

function deps(over: Partial<StartCheckoutDeps> = {}): StartCheckoutDeps {
  return {
    loadVariants: vi.fn().mockResolvedValue([variant]),
    createPendingOrder: vi.fn().mockResolvedValue('order-1'),
    attachCheckout: vi.fn().mockResolvedValue(undefined),
    cancelOrder: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue({ id: 'cs_1', checkoutUrl: 'https://checkout.paymongo.com/cs_1' }),
    shippingFeeCentavos: 15000,
    siteUrl: 'https://shop.test',
    paymentMethods: ['card', 'gcash'],
    ...over,
  }
}

describe('startCheckoutCore', () => {
  it('creates a pending order, a session with success/cancel URLs, and redirects', async () => {
    const d = deps()
    const r = await startCheckoutCore(form, cart, d)
    expect(r).toEqual({ kind: 'redirect', url: 'https://checkout.paymongo.com/cs_1' })
    expect(d.createPendingOrder).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 45000, shipping: 15000, total: 60000 }))
    expect(d.createSession).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1',
      successUrl: 'https://shop.test/order/order-1',
      cancelUrl: 'https://shop.test/cart?cancelled=1',
    }))
    expect(d.attachCheckout).toHaveBeenCalledWith('order-1', 'cs_1')
  })
  it('returns cart problems without creating an order', async () => {
    const d = deps({ loadVariants: vi.fn().mockResolvedValue([{ ...variant, stock: 0 }]) })
    const r = await startCheckoutCore(form, cart, d)
    expect(r.kind).toBe('cart_problems')
    expect(d.createPendingOrder).not.toHaveBeenCalled()
  })
  it('cancels the order and reports an error if PayMongo fails', async () => {
    const d = deps({ createSession: vi.fn().mockRejectedValue(new Error('down')) })
    const r = await startCheckoutCore(form, cart, d)
    expect(r).toEqual({ kind: 'error', message: expect.stringContaining('payment page') })
    expect(d.cancelOrder).toHaveBeenCalledWith('order-1')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/checkout src/lib/paymongo src/lib/orders`
Expected: FAIL. The modules don't exist yet.

- [ ] **Step 3: Implement**

`src/lib/orders/format.ts`:
```ts
export const formatOrderNumber = (id: string) => id.slice(0, 8).toUpperCase()

const manila = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
// Newer ICU puts a narrow no-break space before AM/PM; normalize so output is stable.
export const formatManilaDate = (iso: string) => manila.format(new Date(iso)).replace(/\u202f/g, ' ')
```

`src/lib/checkout/types.ts`:
```ts
import type { Size } from '@/lib/catalog/constants'

export type CartProblem = {
  variantId: string
  reason: 'unavailable' | 'insufficient_stock' | 'price_changed'
  available: number
  currentPriceCentavos?: number
  name?: string
  size?: Size
}

export type DbVariant = {
  id: string
  size: Size
  stock: number
  product: { id: string; name: string; isActive: boolean; priceCentavos: number }
}

export type PricedLine = { variantId: string; productName: string; size: Size; qty: number; priceCentavos: number }
```

`src/lib/checkout/schema.ts`:
```ts
import { z } from 'zod'
import { MAX_QTY_PER_LINE } from '@/lib/cart/cart'

const PH_MOBILE = /^(?:\+?63|0)(9\d{9})$/
const text = (label: string) => z.string().trim().min(2, `Enter your ${label}`).max(200)

export const addressSchema = z.object({
  street: text('street address'),
  barangay: text('barangay'),
  city: text('city or municipality'),
  province: text('province'),
  zip: z.string().trim().regex(/^\d{4}$/, 'Philippine ZIP codes have 4 digits'),
})
export type Address = z.infer<typeof addressSchema>

export const checkoutFormSchema = addressSchema.extend({
  name: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(PH_MOBILE, 'Enter a PH mobile number like 0917 123 4567'))
    .transform((s) => `+63${s.match(PH_MOBILE)![1]}`),
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
})
export type CheckoutForm = z.infer<typeof checkoutFormSchema>

export const cartPayloadSchema = z
  .array(z.object({ variantId: z.uuid(), qty: z.number().int().min(1).max(MAX_QTY_PER_LINE), priceCentavos: z.number().int().nonnegative() }))
  .min(1)
  .max(50)
export type CartPayloadLine = z.infer<typeof cartPayloadSchema>[number]
```

`src/lib/checkout/price-cart.ts`:
```ts
import { computeTotals } from '@/lib/cart/totals'
import type { CartPayloadLine } from './schema'
import type { CartProblem, DbVariant, PricedLine } from './types'

export type PriceCartResult =
  | { ok: true; lines: PricedLine[]; subtotal: number; shipping: number; total: number }
  | { ok: false; problems: CartProblem[] }

export function priceCart(requested: CartPayloadLine[], variants: DbVariant[], shippingFeeCentavos: number): PriceCartResult {
  const merged = new Map<string, { qty: number; seenPrice: number }>()
  for (const r of requested) {
    const prev = merged.get(r.variantId)
    merged.set(r.variantId, { qty: (prev?.qty ?? 0) + r.qty, seenPrice: r.priceCentavos })
  }
  const byId = new Map(variants.map((v) => [v.id, v]))
  const problems: CartProblem[] = []
  const lines: PricedLine[] = []

  for (const [variantId, { qty, seenPrice }] of merged) {
    const v = byId.get(variantId)
    const named = v ? { name: v.product.name, size: v.size } : {}
    if (!v || !v.product.isActive || v.stock <= 0) {
      problems.push({ variantId, reason: 'unavailable', available: 0, ...named })
    } else if (qty > v.stock) {
      problems.push({ variantId, reason: 'insufficient_stock', available: v.stock, ...named })
    } else if (seenPrice !== v.product.priceCentavos) {
      problems.push({ variantId, reason: 'price_changed', available: v.stock, currentPriceCentavos: v.product.priceCentavos, ...named })
    } else {
      lines.push({ variantId, productName: v.product.name, size: v.size, qty, priceCentavos: v.product.priceCentavos })
    }
  }

  if (problems.length > 0) return { ok: false, problems }
  const subtotal = lines.reduce((n, l) => n + l.qty * l.priceCentavos, 0)
  return { ok: true, lines, ...computeTotals(subtotal, shippingFeeCentavos) }
}
```

`src/lib/checkout/problems.ts`:
```ts
import { formatPeso } from '@/lib/money'
import type { CartProblem } from './types'

export function problemMessage(p: CartProblem): string {
  if (!p.name || !p.size) return 'An item in your cart is no longer available.'
  const item = p.size === 'OS' ? p.name : `${p.name} (${p.size})`
  switch (p.reason) {
    case 'unavailable': return `${item} is sold out.`
    case 'insufficient_stock': return `Only ${p.available} left of ${item}.`
    case 'price_changed': return `${item} is now ${formatPeso(p.currentPriceCentavos ?? 0)}.`
  }
}
```

Modify `src/lib/cart/cart.ts`. Add `import type { CartProblem } from '@/lib/checkout/types'`, extend the union with `| { type: 'applyProblems'; problems: CartProblem[] }`, and add this case to the reducer:
```ts
    case 'applyProblems': {
      const byId = new Map(action.problems.map((p) => [p.variantId, p]))
      const lines = state.lines.flatMap((l) => {
        const p = byId.get(l.variantId)
        if (!p) return [l]
        if (p.reason === 'unavailable' || p.available <= 0) return []
        if (p.reason === 'insufficient_stock') return [{ ...l, qty: Math.min(l.qty, p.available), maxQty: p.available }]
        return [{ ...l, priceCentavos: p.currentPriceCentavos ?? l.priceCentavos, maxQty: p.available, qty: Math.min(l.qty, p.available) }]
      })
      return { ...state, lines }
    }
```

`src/lib/paymongo/client.ts`:
```ts
import type { PricedLine } from '@/lib/checkout/types'
import { formatOrderNumber } from '@/lib/orders/format'

const API_BASE = 'https://api.paymongo.com/v1'

export class PayMongoError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message)
    this.name = 'PayMongoError'
  }
}

export type CheckoutSessionInput = {
  orderId: string
  lines: PricedLine[]
  shippingCentavos: number
  customer: { name: string; email: string; phone: string }
  successUrl: string
  cancelUrl: string
  paymentMethods: string[]
}

export async function createCheckoutSession(
  input: CheckoutSessionInput,
  { secretKey, fetchImpl = fetch }: { secretKey: string; fetchImpl?: typeof fetch },
): Promise<{ id: string; checkoutUrl: string }> {
  const lineItems = input.lines.map((l) => ({
    currency: 'PHP',
    amount: l.priceCentavos,
    name: l.size === 'OS' ? l.productName : `${l.productName} (${l.size})`,
    quantity: l.qty,
  }))
  if (input.shippingCentavos > 0) lineItems.push({ currency: 'PHP', amount: input.shippingCentavos, name: 'Shipping (flat rate)', quantity: 1 })

  const res = await fetchImpl(`${API_BASE}/checkout_sessions`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: lineItems,
          payment_method_types: input.paymentMethods,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          reference_number: input.orderId,
          description: `The Overruns Project order ${formatOrderNumber(input.orderId)}`,
          billing: input.customer,
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          metadata: { order_id: input.orderId },
        },
      },
    }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new PayMongoError(`PayMongo checkout session failed (${res.status})`, res.status, body)
  return { id: body.data.id, checkoutUrl: body.data.attributes.checkout_url }
}
```

`src/lib/checkout/start-checkout.ts`:
```ts
import type { CheckoutSessionInput } from '@/lib/paymongo/client'
import { priceCart } from './price-cart'
import type { CartPayloadLine, CheckoutForm } from './schema'
import type { CartProblem, DbVariant, PricedLine } from './types'

export type NewOrder = { customer: CheckoutForm; lines: PricedLine[]; subtotal: number; shipping: number; total: number }

export type StartCheckoutDeps = {
  loadVariants(ids: string[]): Promise<DbVariant[]>
  createPendingOrder(order: NewOrder): Promise<string>
  attachCheckout(orderId: string, checkoutId: string): Promise<void>
  cancelOrder(orderId: string): Promise<void>
  createSession(input: CheckoutSessionInput): Promise<{ id: string; checkoutUrl: string }>
  shippingFeeCentavos: number
  siteUrl: string
  paymentMethods: string[]
}

export type StartCheckoutResult =
  | { kind: 'redirect'; url: string }
  | { kind: 'cart_problems'; problems: CartProblem[] }
  | { kind: 'error'; message: string }

export async function startCheckoutCore(form: CheckoutForm, cart: CartPayloadLine[], deps: StartCheckoutDeps): Promise<StartCheckoutResult> {
  const variants = await deps.loadVariants([...new Set(cart.map((l) => l.variantId))])
  const priced = priceCart(cart, variants, deps.shippingFeeCentavos)
  if (!priced.ok) return { kind: 'cart_problems', problems: priced.problems }

  const orderId = await deps.createPendingOrder({ customer: form, lines: priced.lines, subtotal: priced.subtotal, shipping: priced.shipping, total: priced.total })
  try {
    const session = await deps.createSession({
      orderId,
      lines: priced.lines,
      shippingCentavos: priced.shipping,
      customer: { name: form.name, email: form.email, phone: form.phone },
      successUrl: `${deps.siteUrl}/order/${orderId}`,
      cancelUrl: `${deps.siteUrl}/cart?cancelled=1`,
      paymentMethods: deps.paymentMethods,
    })
    await deps.attachCheckout(orderId, session.id)
    return { kind: 'redirect', url: session.checkoutUrl }
  } catch (err) {
    console.error('[checkout] PayMongo session failed', err)
    await deps.cancelOrder(orderId)
    return { kind: 'error', message: "We couldn't open the payment page. Please try again in a minute." }
  }
}
```

`src/lib/checkout/deps.ts`:
```ts
import 'server-only'
import { SHIPPING_FEE_CENTAVOS, siteUrl } from '@/lib/config'
import { createCheckoutSession } from '@/lib/paymongo/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StartCheckoutDeps } from './start-checkout'

export function buildCheckoutDeps(secretKey: string): StartCheckoutDeps {
  const db = createAdminClient()
  return {
    async loadVariants(ids) {
      const { data, error } = await db.from('product_variants').select('id, size, stock, products!inner(id, name, is_active, price_centavos)').in('id', ids)
      if (error) throw error
      return data.map((v) => ({
        id: v.id, size: v.size, stock: v.stock,
        product: { id: v.products.id, name: v.products.name, isActive: v.products.is_active, priceCentavos: v.products.price_centavos },
      }))
    },
    async createPendingOrder({ customer, lines, subtotal, shipping, total }) {
      const { name, email, phone, street, barangay, city, province, zip } = customer
      const { data: order, error } = await db
        .from('orders')
        .insert({ customer_name: name, email, phone, address: { street, barangay, city, province, zip }, subtotal_centavos: subtotal, shipping_centavos: shipping, total_centavos: total })
        .select('id')
        .single()
      if (error) throw error
      const { error: itemsError } = await db.from('order_items').insert(
        lines.map((l) => ({ order_id: order.id, variant_id: l.variantId, product_name: l.productName, size: l.size, qty: l.qty, price_centavos: l.priceCentavos })),
      )
      if (itemsError) {
        await db.from('orders').delete().eq('id', order.id)
        throw itemsError
      }
      return order.id
    },
    async attachCheckout(orderId, checkoutId) {
      const { error } = await db.from('orders').update({ paymongo_checkout_id: checkoutId }).eq('id', orderId)
      if (error) throw error
    },
    async cancelOrder(orderId) {
      await db.from('orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'pending')
    },
    createSession: (input) => createCheckoutSession(input, { secretKey }),
    shippingFeeCentavos: SHIPPING_FEE_CENTAVOS,
    siteUrl: siteUrl(),
    paymentMethods: (process.env.PAYMONGO_PAYMENT_METHODS ?? 'card,gcash,paymaya,qrph').split(',').map((s) => s.trim()).filter(Boolean),
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test && npm run typecheck`
Expected: PASS. If the `products!inner(...)` embed types as an array, re-run `npm run db:types` and check that `product_variants.product_id` has its FK. Supabase types a many-to-one embed as an object.

- [ ] **Step 5: Server action, page and form**

`src/app/(shop)/checkout/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { buildCheckoutDeps } from '@/lib/checkout/deps'
import { cartPayloadSchema, checkoutFormSchema } from '@/lib/checkout/schema'
import { startCheckoutCore } from '@/lib/checkout/start-checkout'
import type { CartProblem } from '@/lib/checkout/types'

const FIELDS = ['name', 'phone', 'email', 'street', 'barangay', 'city', 'province', 'zip'] as const

export type CheckoutActionState =
  | { status: 'idle'; values?: Record<string, string> }
  | { status: 'invalid'; fieldErrors: Partial<Record<(typeof FIELDS)[number], string[]>>; values: Record<string, string> }
  | { status: 'cart_problems'; problems: CartProblem[]; values: Record<string, string> }
  | { status: 'error'; message: string; values: Record<string, string> }

export async function startCheckout(_prev: CheckoutActionState, formData: FormData): Promise<CheckoutActionState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? '')]))
  const form = checkoutFormSchema.safeParse(values)
  if (!form.success) return { status: 'invalid', fieldErrors: z.flattenError(form.error).fieldErrors, values }

  let cartJson: unknown = null
  try {
    cartJson = JSON.parse(String(formData.get('cart') ?? ''))
  } catch {}
  const cart = cartPayloadSchema.safeParse(cartJson)
  if (!cart.success) return { status: 'error', message: 'Your cart is empty or out of date. Please go back to your cart.', values }

  const secretKey = process.env.PAYMONGO_SECRET_KEY
  if (!secretKey) return { status: 'error', message: 'Payments are not configured yet (PAYMONGO_SECRET_KEY is missing).', values }

  const result = await startCheckoutCore(form.data, cart.data, buildCheckoutDeps(secretKey))
  if (result.kind === 'redirect') redirect(result.url)
  return result.kind === 'cart_problems' ? { status: 'cart_problems', problems: result.problems, values } : { status: 'error', message: result.message, values }
}
```

`src/components/checkout/checkout-form.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { startCheckout, type CheckoutActionState } from '@/app/(shop)/checkout/actions'
import { useCart } from '@/components/cart/cart-provider'
import { buttonPrimary, buttonSecondary, inputBase } from '@/components/ui/styles'
import { computeTotals } from '@/lib/cart/totals'
import { sizeLabel } from '@/lib/catalog/constants'
import { problemMessage } from '@/lib/checkout/problems'
import { SHIPPING_FEE_CENTAVOS } from '@/lib/config'
import { formatPeso } from '@/lib/money'

const fields = [
  { name: 'name', label: 'Full name', autoComplete: 'name', type: 'text' },
  { name: 'phone', label: 'Mobile number', autoComplete: 'tel', type: 'tel', placeholder: '0917 123 4567' },
  { name: 'email', label: 'Email', autoComplete: 'email', type: 'email' },
  { name: 'street', label: 'House no., street, building', autoComplete: 'address-line1', type: 'text' },
  { name: 'barangay', label: 'Barangay', autoComplete: 'address-line2', type: 'text' },
  { name: 'city', label: 'City / municipality', autoComplete: 'address-level2', type: 'text' },
  { name: 'province', label: 'Province', autoComplete: 'address-level1', type: 'text' },
  { name: 'zip', label: 'ZIP code', autoComplete: 'postal-code', type: 'text', inputMode: 'numeric' as const },
] as const

export function CheckoutForm() {
  const { lines, subtotal, hydrated, dispatch } = useCart()
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(startCheckout, { status: 'idle' })
  if (!hydrated) return <p className="text-muted">Loading…</p>
  if (lines.length === 0) return <p>Your cart is empty. <Link href="/shop" className="underline">Go shopping</Link></p>

  const totals = computeTotals(subtotal, SHIPPING_FEE_CENTAVOS)
  const errors = state.status === 'invalid' ? state.fieldErrors : {}
  const cartJson = JSON.stringify(lines.map((l) => ({ variantId: l.variantId, qty: l.qty, priceCentavos: l.priceCentavos })))

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="cart" value={cartJson} />

      {state.status === 'cart_problems' ? (
        <div role="alert" className="space-y-3 border border-ink bg-card p-4">
          <p className="font-semibold">Some items changed since you added them:</p>
          <ul className="list-disc pl-5 text-sm">{state.problems.map((p) => <li key={p.variantId}>{problemMessage(p)}</li>)}</ul>
          <button type="button" className={buttonSecondary} onClick={() => dispatch({ type: 'applyProblems', problems: state.problems })}>Update my cart</button>
        </div>
      ) : null}
      {state.status === 'error' ? <p role="alert" className="border border-tag bg-card p-3 text-sm">{state.message}</p> : null}

      <fieldset className="space-y-4">
        <legend className="font-display text-lg">Contact and delivery</legend>
        {fields.map((f) => {
          const err = errors[f.name]?.[0]
          return (
            <div key={f.name} className="space-y-1">
              <label htmlFor={f.name} className="text-sm font-semibold">{f.label}</label>
              <input
                id={f.name} name={f.name} type={f.type} autoComplete={f.autoComplete}
                inputMode={'inputMode' in f ? f.inputMode : undefined}
                placeholder={'placeholder' in f ? f.placeholder : undefined}
                defaultValue={state.values?.[f.name] ?? ''}
                aria-invalid={err ? true : undefined}
                aria-describedby={err ? `${f.name}-error` : undefined}
                className={inputBase}
              />
              {err ? <p id={`${f.name}-error`} className="text-sm font-semibold">{err}</p> : null}
            </div>
          )
        })}
      </fieldset>

      <section className="space-y-2 border border-ink bg-card p-4">
        <h2 className="font-display text-lg">Order summary</h2>
        <ul className="space-y-1 text-sm">
          {lines.map((l) => <li key={l.variantId} className="flex justify-between"><span>{l.qty} × {l.name} ({sizeLabel(l.size)})</span><span>{formatPeso(l.qty * l.priceCentavos)}</span></li>)}
        </ul>
        <dl className="space-y-1 border-t border-ink pt-2 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPeso(totals.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{formatPeso(totals.shipping)}</dd></div>
          <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatPeso(totals.total)}</dd></div>
        </dl>
      </section>

      <div className="space-y-2">
        <p className="flex gap-2 text-xs font-semibold uppercase">
          {['GCash', 'Maya', 'Card', 'QR Ph'].map((m) => <span key={m} className="border border-ink bg-card px-2 py-1">{m}</span>)}
        </p>
        <button type="submit" disabled={pending} className={`${buttonPrimary} w-full`}>{pending ? 'Opening PayMongo…' : 'Pay with PayMongo'}</button>
        <p className="text-xs text-muted">Test mode: no real money is charged.</p>
      </div>
    </form>
  )
}
```

`src/app/(shop)/checkout/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/checkout/checkout-form'

export const metadata: Metadata = { title: 'Checkout' }

export default function CheckoutPage() {
  return (
    <div className="max-w-xl space-y-6 px-4 py-6">
      <h1 className="font-display text-2xl">Checkout</h1>
      <CheckoutForm />
    </div>
  )
}
```

- [ ] **Step 6: Create a PayMongo test account and check by hand**

Ask the user before creating accounts. Sign up at https://dashboard.paymongo.com (free; test mode works before business verification). Copy the **test** secret key (`sk_test_…`) into `.env.local` as `PAYMONGO_SECRET_KEY`. If the session call rejects a method in `PAYMONGO_PAYMENT_METHODS`, remove that method; the account may not have it enabled.

Run: `npm run dev`. Add an item, go to checkout, and submit with bad data (inline errors, values kept). Submit valid data and expect a redirect to `checkout.paymongo.com`. Click "Back" or cancel on PayMongo and expect `/cart?cancelled=1` with the cart intact. In Supabase Studio (http://127.0.0.1:54323), the order is `pending` with `paymongo_checkout_id = cs_…`. In Studio, set a variant's stock to 0, then submit checkout: the problem list appears, and "Update my cart" fixes the cart.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(checkout): server-side repricing, pending orders and PayMongo checkout sessions"
```

---

### Task 8: Order page and confirmation email

**Files:**
- Create: `src/lib/orders/queries.ts`, `src/lib/email/{order-confirmation.ts,send.ts,send-order-confirmation.ts}`, `src/components/order/pending-refresher.tsx`, `src/components/cart/clear-cart-on-mount.tsx`, `src/app/(shop)/order/[id]/page.tsx`
- Test: `src/lib/orders/queries.test.ts`, `src/lib/email/order-confirmation.test.ts`

**Interfaces:**
- Consumes: `createAdminClient`, `Db` (Task 3); `formatOrderNumber`, `formatManilaDate`, `addressSchema`, `Address` (Task 7); `siteUrl` (Task 1).
- Produces:
  - `type OrderDetail = { id: string; customerName: string; email: string; phone: string; address: Address | null; subtotalCentavos: number; shippingCentavos: number; totalCentavos: number; status: OrderStatus; oversold: boolean; createdAt: string; items: { productName: string; size: Size; qty: number; priceCentavos: number }[] }`
  - `isUuid(s: string): boolean`, `getOrderDetail(db: Db, id: string): Promise<OrderDetail | null>`
  - `renderOrderConfirmation(order: OrderDetail, siteUrl: string): { subject: string; html: string; text: string }`, `escapeHtml(s)`
  - `sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<void>`
  - `sendOrderConfirmation(orderId: string): Promise<void>`

- [ ] **Step 1: Write failing tests**

`src/lib/orders/queries.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isUuid } from './queries'

describe('isUuid', () => {
  it('accepts UUIDs and rejects anything else', () => {
    expect(isUuid('3f2a9c1e-1234-4abc-8def-0123456789ab')).toBe(true)
    expect(isUuid('3f2a9c1e')).toBe(false)
    expect(isUuid("'; drop table orders; --")).toBe(false)
  })
})
```

`src/lib/email/order-confirmation.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { OrderDetail } from '@/lib/orders/queries'
import { renderOrderConfirmation } from './order-confirmation'

const order: OrderDetail = {
  id: '3f2a9c1e-1234-4abc-8def-0123456789ab', customerName: 'Juan <script>alert(1)</script>', email: 'juan@example.com', phone: '+639171234567',
  address: { street: '12 Mabini St', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '1210' },
  subtotalCentavos: 298000, shippingCentavos: 15000, totalCentavos: 313000, status: 'paid', oversold: false, createdAt: '2026-10-15T08:00:00Z',
  items: [{ productName: 'Coach Jacket', size: 'M', qty: 2, priceCentavos: 149000 }],
}

describe('renderOrderConfirmation', () => {
  it('includes order number, items, totals and a link to the order page', () => {
    const { subject, html, text } = renderOrderConfirmation(order, 'https://shop.test')
    expect(subject).toBe('Salamat! Order 3F2A9C1E is confirmed')
    expect(html).toContain('2 × Coach Jacket (M)')
    expect(html).toContain('₱3,130')
    expect(html).toContain('https://shop.test/order/3f2a9c1e-1234-4abc-8def-0123456789ab')
    expect(text).toContain('Total: ₱3,130')
  })
  it('escapes customer-provided text', () => {
    const { html } = renderOrderConfirmation(order, 'https://shop.test')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/orders src/lib/email`
Expected: FAIL. The modules don't exist yet.

- [ ] **Step 3: Implement**

`src/lib/orders/queries.ts`:
```ts
import type { OrderStatus, Size } from '@/lib/catalog/constants'
import { addressSchema, type Address } from '@/lib/checkout/schema'
import type { Db } from '@/lib/supabase/server'

export type OrderItem = { productName: string; size: Size; qty: number; priceCentavos: number }
export type OrderDetail = {
  id: string
  customerName: string
  email: string
  phone: string
  address: Address | null
  subtotalCentavos: number
  shippingCentavos: number
  totalCentavos: number
  status: OrderStatus
  oversold: boolean
  createdAt: string
  items: OrderItem[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s: string) => UUID.test(s)

export async function getOrderDetail(db: Db, id: string): Promise<OrderDetail | null> {
  if (!isUuid(id)) return null
  const { data, error } = await db
    .from('orders')
    .select('id, customer_name, email, phone, address, subtotal_centavos, shipping_centavos, total_centavos, status, oversold, created_at, order_items(product_name, size, qty, price_centavos)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const address = addressSchema.safeParse(data.address)
  return {
    id: data.id,
    customerName: data.customer_name,
    email: data.email,
    phone: data.phone,
    address: address.success ? address.data : null,
    subtotalCentavos: data.subtotal_centavos,
    shippingCentavos: data.shipping_centavos,
    totalCentavos: data.total_centavos,
    status: data.status,
    oversold: data.oversold,
    createdAt: data.created_at,
    items: data.order_items.map((i) => ({ productName: i.product_name, size: i.size, qty: i.qty, priceCentavos: i.price_centavos })),
  }
}
```

`src/lib/email/order-confirmation.ts`:
```ts
import { sizeLabel } from '@/lib/catalog/constants'
import { formatPeso } from '@/lib/money'
import { formatOrderNumber } from '@/lib/orders/format'
import type { OrderDetail } from '@/lib/orders/queries'

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function renderOrderConfirmation(order: OrderDetail, siteUrl: string) {
  const number = formatOrderNumber(order.id)
  const url = `${siteUrl}/order/${order.id}`
  const itemLine = (i: OrderDetail['items'][number]) => `${i.qty} × ${i.productName} (${sizeLabel(i.size)})`
  const a = order.address
  const addressText = a ? `${a.street}, ${a.barangay}, ${a.city}, ${a.province} ${a.zip}` : ''

  const html = `<!doctype html><html><body style="margin:0;background:#F5F3EE;font-family:Inter,Arial,sans-serif;color:#111111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:1px solid #111111" cellpadding="24">
<tr><td>
<p style="margin:0 0 4px;font-weight:900;text-transform:uppercase;letter-spacing:.02em">The Overruns Project</p>
<h1 style="margin:0 0 16px;font-size:22px">Salamat, ${escapeHtml(order.customerName)}! Your order is confirmed.</h1>
<p style="margin:0 0 16px">Order <strong>${number}</strong></p>
<table role="presentation" width="100%" style="border-top:1px solid #111111;border-bottom:1px solid #111111" cellpadding="6">
${order.items.map((i) => `<tr><td>${escapeHtml(itemLine(i))}</td><td align="right">${formatPeso(i.qty * i.priceCentavos)}</td></tr>`).join('')}
<tr><td style="color:#6B6B6B">Shipping</td><td align="right" style="color:#6B6B6B">${formatPeso(order.shippingCentavos)}</td></tr>
<tr><td><strong>Total</strong></td><td align="right"><strong>${formatPeso(order.totalCentavos)}</strong></td></tr>
</table>
<p style="margin:16px 0 4px;font-weight:bold">Delivering to</p>
<p style="margin:0 0 16px;color:#6B6B6B">${escapeHtml(addressText)}</p>
<p style="margin:0"><a href="${url}" style="display:inline-block;background:#E85D2A;color:#111111;border:1px solid #111111;padding:12px 20px;font-weight:bold;text-decoration:none;text-transform:uppercase">View your order</a></p>
</td></tr></table></td></tr></table></body></html>`

  const text = [
    `Salamat, ${order.customerName}! Your order ${number} is confirmed.`,
    '',
    ...order.items.map((i) => `${itemLine(i)}  ${formatPeso(i.qty * i.priceCentavos)}`),
    `Shipping: ${formatPeso(order.shippingCentavos)}`,
    `Total: ${formatPeso(order.totalCentavos)}`,
    '',
    `Delivering to: ${addressText}`,
    `View your order: ${url}`,
  ].join('\n')

  return { subject: `Salamat! Order ${number} is confirmed`, html, text }
}
```

`src/lib/email/send.ts`:
```ts
import 'server-only'
import { Resend } from 'resend'

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.info('[email] RESEND_API_KEY not set; skipping send', { to: msg.to, subject: msg.subject })
    return
  }
  const { error } = await new Resend(key).emails.send({
    from: process.env.EMAIL_FROM ?? 'The Overruns Project <onboarding@resend.dev>',
    ...msg,
  })
  if (error) throw new Error(`Resend failed: ${error.message}`)
}
```

`src/lib/email/send-order-confirmation.ts`:
```ts
import 'server-only'
import { siteUrl } from '@/lib/config'
import { getOrderDetail } from '@/lib/orders/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderOrderConfirmation } from './order-confirmation'
import { sendEmail } from './send'

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await getOrderDetail(createAdminClient(), orderId)
  if (!order) throw new Error(`Order ${orderId} not found`)
  await sendEmail({ to: order.email, ...renderOrderConfirmation(order, siteUrl()) })
}
```

`src/components/order/pending-refresher.tsx`:
```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

// The webhook may land a few seconds after PayMongo redirects back; poll briefly.
export function PendingRefresher({ intervalMs = 3000, maxTries = 20 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter()
  const [tries, setTries] = useState(0)
  useEffect(() => {
    if (tries >= maxTries) return
    const t = setTimeout(() => {
      router.refresh()
      setTries((n) => n + 1)
    }, intervalMs)
    return () => clearTimeout(t)
  }, [tries, maxTries, intervalMs, router])
  return (
    <p role="status" className="text-muted">
      {tries >= maxTries ? "Still waiting on PayMongo. We'll email you as soon as your payment is confirmed." : 'Confirming your payment…'}
    </p>
  )
}
```

`src/components/cart/clear-cart-on-mount.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import { useCart } from './cart-provider'

export function ClearCartOnMount() {
  const { hydrated, dispatch } = useCart()
  // Wait for hydration, or the stored cart would be restored right after clearing.
  useEffect(() => {
    if (hydrated) dispatch({ type: 'clear' })
  }, [hydrated, dispatch])
  return null
}
```

`src/app/(shop)/order/[id]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClearCartOnMount } from '@/components/cart/clear-cart-on-mount'
import { PendingRefresher } from '@/components/order/pending-refresher'
import { buttonPrimary } from '@/components/ui/styles'
import { sizeLabel } from '@/lib/catalog/constants'
import { formatPeso } from '@/lib/money'
import { formatOrderNumber } from '@/lib/orders/format'
import { getOrderDetail } from '@/lib/orders/queries'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your order', robots: { index: false } }

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const order = await getOrderDetail(createAdminClient(), (await params).id)
  if (!order) notFound()
  const a = order.address
  const paidOrLater = order.status === 'paid' || order.status === 'shipped'

  return (
    <div className="max-w-xl space-y-6 px-4 py-8">
      <ClearCartOnMount />
      {paidOrLater ? (
        <div className="space-y-2">
          <div aria-hidden className="flex h-14 w-14 items-center justify-center border border-ink bg-tag text-3xl">✓</div>
          <h1 className="font-display text-2xl">Salamat! Your order is confirmed</h1>
        </div>
      ) : order.status === 'cancelled' ? (
        <h1 className="font-display text-2xl">This order was cancelled</h1>
      ) : (
        <div className="space-y-2">
          <h1 className="font-display text-2xl">Almost there</h1>
          <PendingRefresher />
        </div>
      )}
      <p>Order <strong>{formatOrderNumber(order.id)}</strong>{order.status === 'shipped' ? ' · Shipped' : ''}</p>
      <ul className="divide-y divide-ink border-y border-ink">
        {order.items.map((i, idx) => (
          <li key={idx} className="flex justify-between py-2 text-sm"><span>{i.qty} × {i.productName} ({sizeLabel(i.size)})</span><span>{formatPeso(i.qty * i.priceCentavos)}</span></li>
        ))}
        <li className="flex justify-between py-2 text-sm text-muted"><span>Shipping</span><span>{formatPeso(order.shippingCentavos)}</span></li>
        <li className="flex justify-between py-2 font-bold"><span>Total</span><span>{formatPeso(order.totalCentavos)}</span></li>
      </ul>
      {a ? (
        <section>
          <h2 className="text-sm font-semibold uppercase">Delivering to</h2>
          <p className="text-muted">{order.customerName}<br />{a.street}, {a.barangay}<br />{a.city}, {a.province} {a.zip}</p>
        </section>
      ) : null}
      <Link href="/shop" className={`${buttonPrimary} w-full`}>Continue shopping</Link>
    </div>
  )
}
```

- [ ] **Step 4: Run tests and check by hand**

Run: `npm test && npm run typecheck`
Expected: PASS.
In dev, open `/order/<pending order id from Task 7>`: it shows "Almost there / Confirming your payment…" and the cart is cleared. `/order/not-a-uuid` gives a 404.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(orders): order status page and HTML confirmation email"
```

---

### Task 9: PayMongo webhook

**Files:**
- Create: `src/lib/paymongo/signature.ts`, `src/lib/paymongo/webhook.ts`, `src/app/api/webhooks/paymongo/route.ts`, `scripts/simulate-paymongo-webhook.ts`
- Test: `src/lib/paymongo/signature.test.ts`, `src/lib/paymongo/webhook.test.ts`

**Interfaces:**
- Consumes: `mark_order_paid` RPC (Task 2), `createAdminClient` (Task 3), `sendOrderConfirmation` (Task 8).
- Produces: `verifyPaymongoSignature({ header, rawBody, secret, livemode, nowMs, toleranceSec? }): boolean`; `handlePaymongoWebhook(req: { rawBody: string; signatureHeader: string | null }, deps: { secret: string; markPaid(checkoutId: string): Promise<string | null>; sendConfirmation(orderId: string): Promise<void>; nowMs(): number }): Promise<{ status: number; body: Record<string, unknown> }>`; `signPaymongoPayload(rawBody, secret, timestampSec): string` (used by the simulator and tests).

- [ ] **Step 1: Write failing tests**

`src/lib/paymongo/signature.test.ts`:
```ts
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
```

`src/lib/paymongo/webhook.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { signPaymongoPayload } from './signature'
import { handlePaymongoWebhook } from './webhook'

const secret = 'whsk_test_secret'
const t = 1_760_000_000
const event = (type = 'checkout_session.payment.paid') =>
  JSON.stringify({ data: { id: 'evt_1', type: 'event', attributes: { type, livemode: false, data: { id: 'cs_123', type: 'checkout_session', attributes: {} } } } })

function deps(markPaid: (id: string) => Promise<string | null> = async () => 'order-1') {
  return { secret, markPaid: vi.fn(markPaid), sendConfirmation: vi.fn(async () => {}), nowMs: () => t * 1000 }
}
const req = (rawBody: string, header: string | null = signPaymongoPayload(rawBody, secret, t)) => ({ rawBody, signatureHeader: header })

describe('handlePaymongoWebhook', () => {
  it('marks the order paid and sends one confirmation', async () => {
    const d = deps()
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r.status).toBe(200)
    expect(d.markPaid).toHaveBeenCalledWith('cs_123')
    expect(d.sendConfirmation).toHaveBeenCalledWith('order-1')
  })
  it('does not email again when the order was already processed', async () => {
    const d = deps(async () => null)
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r.status).toBe(200)
    expect(d.sendConfirmation).not.toHaveBeenCalled()
  })
  it('rejects a bad signature without touching the database', async () => {
    const d = deps()
    const r = await handlePaymongoWebhook(req(event(), 't=1,te=deadbeef,li='), d)
    expect(r.status).toBe(401)
    expect(d.markPaid).not.toHaveBeenCalled()
  })
  it('returns 400 for a body that is not JSON', async () => {
    const r = await handlePaymongoWebhook(req('not json'), deps())
    expect(r.status).toBe(400)
  })
  it('ignores other event types', async () => {
    const d = deps()
    const r = await handlePaymongoWebhook(req(event('payment.failed')), d)
    expect(r).toEqual({ status: 200, body: { ignored: 'payment.failed' } })
    expect(d.markPaid).not.toHaveBeenCalled()
  })
  it('still returns 200 if the email fails (stock is already updated)', async () => {
    const d = deps()
    d.sendConfirmation.mockRejectedValueOnce(new Error('resend down'))
    const r = await handlePaymongoWebhook(req(event()), d)
    expect(r.status).toBe(200)
  })
  it('returns 500 when the webhook secret is not configured', async () => {
    const r = await handlePaymongoWebhook(req(event()), { ...deps(), secret: '' })
    expect(r.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/paymongo`
Expected: FAIL. `./signature` and `./webhook` don't exist yet.

- [ ] **Step 3: Implement**

`src/lib/paymongo/signature.ts`:
```ts
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
```

`src/lib/paymongo/webhook.ts`:
```ts
import { verifyPaymongoSignature } from './signature'

export type WebhookDeps = {
  secret: string
  markPaid(checkoutId: string): Promise<string | null>
  sendConfirmation(orderId: string): Promise<void>
  nowMs(): number
}
type Result = { status: number; body: Record<string, unknown> }

type PaymongoEvent = { data?: { attributes?: { type?: string; livemode?: boolean; data?: { id?: string } } } }

export async function handlePaymongoWebhook(req: { rawBody: string; signatureHeader: string | null }, deps: WebhookDeps): Promise<Result> {
  if (!deps.secret) return { status: 500, body: { error: 'webhook secret not configured' } }

  let event: PaymongoEvent
  try {
    event = JSON.parse(req.rawBody)
  } catch {
    return { status: 400, body: { error: 'invalid JSON' } }
  }
  const attrs = event.data?.attributes
  // livemode only selects which signature (te/li) to check; both are keyed by our secret.
  const signed = verifyPaymongoSignature({ header: req.signatureHeader, rawBody: req.rawBody, secret: deps.secret, livemode: attrs?.livemode === true, nowMs: deps.nowMs() })
  if (!signed) return { status: 401, body: { error: 'invalid signature' } }

  if (attrs?.type !== 'checkout_session.payment.paid') return { status: 200, body: { ignored: attrs?.type ?? 'unknown' } }
  const checkoutId = attrs.data?.id
  if (!checkoutId) return { status: 400, body: { error: 'missing checkout session id' } }

  const orderId = await deps.markPaid(checkoutId) // throws → 500 → PayMongo retries
  if (!orderId) return { status: 200, body: { ignored: 'already processed or unknown checkout session' } }

  try {
    await deps.sendConfirmation(orderId)
  } catch (err) {
    console.error('[webhook] confirmation email failed', { orderId, err })
  }
  return { status: 200, body: { ok: true, orderId } }
}
```

`src/app/api/webhooks/paymongo/route.ts`:
```ts
import { revalidatePath } from 'next/cache'
import { sendOrderConfirmation } from '@/lib/email/send-order-confirmation'
import { handlePaymongoWebhook } from '@/lib/paymongo/webhook'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const result = await handlePaymongoWebhook(
    { rawBody: await request.text(), signatureHeader: request.headers.get('paymongo-signature') },
    {
      secret: process.env.PAYMONGO_WEBHOOK_SECRET ?? '',
      async markPaid(checkoutId) {
        const { data, error } = await createAdminClient().rpc('mark_order_paid', { p_checkout_id: checkoutId })
        if (error) throw error
        if (data) {
          // Stock changed: refresh cached catalog pages.
          revalidatePath('/')
          revalidatePath('/shop')
          revalidatePath('/product/[slug]', 'page')
        }
        return data
      },
      sendConfirmation: sendOrderConfirmation,
      nowMs: () => Date.now(),
    },
  )
  return Response.json(result.body, { status: result.status })
}
```

`scripts/simulate-paymongo-webhook.ts`:
```ts
// Usage: npx tsx scripts/simulate-paymongo-webhook.ts cs_xxx [http://localhost:3000]
// Sends a correctly signed checkout_session.payment.paid event, the same way PayMongo would.
import { signPaymongoPayload } from '../src/lib/paymongo/signature'

process.loadEnvFile('.env.local')
const [checkoutId, base = 'http://localhost:3000'] = process.argv.slice(2)
const secret = process.env.PAYMONGO_WEBHOOK_SECRET
if (!checkoutId || !secret) {
  console.error('Usage: simulate-paymongo-webhook.ts <cs_id> [baseUrl]  (needs PAYMONGO_WEBHOOK_SECRET in .env.local)')
  process.exit(1)
}
const body = JSON.stringify({
  data: { id: `evt_sim_${Date.now()}`, type: 'event', attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: checkoutId, type: 'checkout_session', attributes: {} } } },
})
const res = await fetch(`${base}/api/webhooks/paymongo`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Paymongo-Signature': signPaymongoPayload(body, secret, Math.floor(Date.now() / 1000)) },
  body,
})
console.log(res.status, await res.text())
```

- [ ] **Step 4: Run tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: End-to-end check locally (no tunnel needed)**

Set `PAYMONGO_WEBHOOK_SECRET=whsk_local_dev` in `.env.local` and restart `npm run dev`. Take the `cs_…` id of a pending order from Task 7, then:
```bash
npx tsx scripts/simulate-paymongo-webhook.ts cs_xxx
npx tsx scripts/simulate-paymongo-webhook.ts cs_xxx
```
Expected: the first call prints `200 {"ok":true,"orderId":"…"}` and the second prints `200 {"ignored":"already processed…"}`. In Studio the order is `paid` and the variant stock dropped once. The dev server logs `[email] RESEND_API_KEY not set; skipping send`. `/order/<id>` now shows "Salamat! Your order is confirmed".

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(payments): signed PayMongo webhook marks orders paid and sends confirmation"
```

---

### Task 10: Admin login and route protection

**Files:**
- Create: `src/lib/auth/paths.ts`, `src/lib/auth/require-admin.ts`, `src/proxy.ts`, `src/app/admin/login/{page.tsx,actions.ts}`, `src/app/admin/(protected)/{layout.tsx,page.tsx}`
- Test: `src/lib/auth/paths.test.ts`

**Interfaces:**
- Consumes: `createClient` (Task 3), `inputBase`/`buttonPrimary` (Task 4).
- Produces: `isProtectedAdminPath(pathname): boolean`, `safeNextPath(next: string | null | undefined): string`, `requireAdmin(): Promise<{ supabase: Db; user: User }>`, `signOut()` server action.

- [ ] **Step 1: Write the failing test**

`src/lib/auth/paths.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isProtectedAdminPath, safeNextPath } from './paths'

describe('isProtectedAdminPath', () => {
  it('protects /admin and everything under it except login', () => {
    expect(isProtectedAdminPath('/admin')).toBe(true)
    expect(isProtectedAdminPath('/admin/orders')).toBe(true)
    expect(isProtectedAdminPath('/admin/login')).toBe(false)
    expect(isProtectedAdminPath('/administrator')).toBe(false)
    expect(isProtectedAdminPath('/shop')).toBe(false)
  })
})

describe('safeNextPath', () => {
  it('only allows redirects back into /admin', () => {
    expect(safeNextPath('/admin/products')).toBe('/admin/products')
    expect(safeNextPath('https://evil.test')).toBe('/admin')
    expect(safeNextPath('//evil.test/admin')).toBe('/admin')
    expect(safeNextPath('/shop')).toBe('/admin')
    expect(safeNextPath(null)).toBe('/admin')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/auth`
Expected: FAIL. `./paths` doesn't exist yet.

- [ ] **Step 3: Implement**

`src/lib/auth/paths.ts`:
```ts
export function isProtectedAdminPath(pathname: string): boolean {
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) return false
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export function safeNextPath(next: string | null | undefined): string {
  if (!next || next.startsWith('//') || !(next === '/admin' || next.startsWith('/admin/'))) return '/admin'
  return next
}
```

`src/proxy.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isProtectedAdminPath } from '@/lib/auth/paths'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && isProtectedAdminPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`
    return NextResponse.redirect(url)
  }
  return response
}

// Only admin routes need a session; shopper pages stay cookie-free and cacheable.
export const config = { matcher: ['/admin/:path*'] }
```

`src/lib/auth/require-admin.ts`:
```ts
import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  const { data: isAdmin, error } = await supabase.rpc('is_admin')
  if (error || !isAdmin) redirect('/admin/login?error=not-admin')
  return { supabase, user }
}
```

`src/app/admin/login/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { safeNextPath } from '@/lib/auth/paths'
import { createClient } from '@/lib/supabase/server'

export async function signIn(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
  if (error) return { error: 'Wrong email or password.' }
  redirect(safeNextPath(String(formData.get('next') ?? '')))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
```

`src/app/admin/login/page.tsx`:
```tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useActionState } from 'react'
import { buttonPrimary, inputBase } from '@/components/ui/styles'
import { signIn } from './actions'

function LoginForm() {
  const params = useSearchParams()
  const [state, action, pending] = useActionState(signIn, {})
  const notAdmin = params.get('error') === 'not-admin'
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={params.get('next') ?? '/admin'} />
      {notAdmin ? <p role="alert" className="border border-ink bg-card p-3 text-sm">That account isn&apos;t an admin.</p> : null}
      {state.error ? <p role="alert" className="border border-tag bg-card p-3 text-sm">{state.error}</p> : null}
      <label className="block space-y-1"><span className="text-sm font-semibold">Email</span><input name="email" type="email" autoComplete="username" required className={inputBase} /></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">Password</span><input name="password" type="password" autoComplete="current-password" required className={inputBase} /></label>
      <button type="submit" disabled={pending} className={`${buttonPrimary} w-full`}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm space-y-6 px-4 py-16">
      <h1 className="font-display text-2xl">Store admin</h1>
      <Suspense><LoginForm /></Suspense>
    </main>
  )
}
```

`src/app/admin/(protected)/layout.tsx`:
```tsx
import Link from 'next/link'
import { signOut } from '@/app/admin/login/actions'
import { requireAdmin } from '@/lib/auth/require-admin'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin()
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-ink bg-card p-4 md:border-b-0 md:border-r">
        <p className="font-display text-sm">Overruns admin</p>
        <nav className="mt-4 flex gap-2 md:flex-col">
          <Link href="/admin/orders" className="flex h-11 items-center px-2 font-semibold hover:bg-paper">Orders</Link>
          <Link href="/admin/products" className="flex h-11 items-center px-2 font-semibold hover:bg-paper">Products</Link>
          <Link href="/" className="flex h-11 items-center px-2 text-muted hover:bg-paper">View store</Link>
        </nav>
        <form action={signOut} className="mt-6 text-sm text-muted">
          <p className="truncate">{user.email}</p>
          <button type="submit" className="h-11 underline">Sign out</button>
        </form>
      </aside>
      <main className="p-4 md:p-8">{children}</main>
    </div>
  )
}
```

`src/app/admin/(protected)/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function AdminIndex() {
  redirect('/admin/orders')
}
```

- [ ] **Step 4: Create the local owner account and check by hand**

In local Studio (http://127.0.0.1:54323), go to Authentication → Add user → email + password, with "Auto confirm" on. Then in the SQL editor:
```sql
insert into public.admins (user_id) select id from auth.users where email = 'owner@example.com';
```
Run: `npm test && npm run typecheck`. In dev:
- `/admin/orders` while signed out redirects to `/admin/login?next=%2Fadmin%2Forders`.
- A wrong password shows "Wrong email or password."
- Signing in lands on `/admin/orders` (a 404 is fine until Task 12).
- A non-admin user (create a second one) is sent back with "That account isn't an admin."

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): owner login, proxy guard and requireAdmin"
```

---

### Task 11: Admin products (create/edit, photos, stock per size)

**Files:**
- Create: `src/lib/admin/product-form.ts`, `src/lib/admin/downscale-image.ts`, `src/components/admin/image-uploader.tsx`, `src/components/admin/product-form.tsx`
- Create: `src/app/admin/(protected)/products/{page.tsx,actions.ts,new/page.tsx,[id]/page.tsx}`
- Test: `src/lib/admin/product-form.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (Task 10); `getProductById`, `listAllProducts`, `productImageUrl`, `PRODUCT_IMAGES_BUCKET`, `CATEGORIES`, `SIZES`, `sizeLabel`, `Product` (Task 3); `createBrowserSupabase` (Task 3); `totalStock` (Task 5); `formatPeso`.
- Produces: `parsePesoToCentavos(s: string): number | null`, `centavosToPesoInput(c: number | null): string`, `slugify(s: string): string`, `type ProductInput`, `parseProductForm(fd: FormData): { ok: true; data: ProductInput } | { ok: false; fieldErrors: Record<string, string> }`, `MAX_IMAGES = 8`, `saveProduct` server action, `type ProductFormState`.

- [ ] **Step 1: Write the failing test**

`src/lib/admin/product-form.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { centavosToPesoInput, parsePesoToCentavos, parseProductForm, slugify } from './product-form'

const fd = (entries: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}
const base = { name: 'Coach Jacket', slug: '', description: 'Nylon', category: 'outerwear', price: '1,490', retailPrice: '4299', images: '["products/a.jpg"]', isActive: 'on', stock_M: '2', stock_L: '0', stock_XL: '' }

describe('parsePesoToCentavos', () => {
  it('parses peso amounts into centavos', () => {
    expect(parsePesoToCentavos('690')).toBe(69000)
    expect(parsePesoToCentavos('₱1,899.50')).toBe(189950)
    expect(parsePesoToCentavos('0.5')).toBe(50)
  })
  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '-1', '1.999', '1e3']) expect(parsePesoToCentavos(bad)).toBeNull()
  })
  it('round-trips through the input formatter', () => {
    expect(centavosToPesoInput(189950)).toBe('1899.50')
    expect(centavosToPesoInput(69000)).toBe('690')
    expect(centavosToPesoInput(null)).toBe('')
  })
})

describe('slugify', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('  Oxford Button-Down (White) ')).toBe('oxford-button-down-white')
    expect(slugify('Piña Polo')).toBe('pina-polo')
  })
})

describe('parseProductForm', () => {
  it('parses a valid form, deriving the slug and keeping only entered sizes', () => {
    const r = parseProductForm(fd(base))
    expect(r).toEqual({
      ok: true,
      data: {
        name: 'Coach Jacket', slug: 'coach-jacket', description: 'Nylon', category: 'outerwear',
        priceCentavos: 149000, retailPriceCentavos: 429900, images: ['products/a.jpg'],
        isActive: true, isFeatured: false, stock: { M: 2, L: 0 },
      },
    })
  })
  it('reports field errors', () => {
    const r = parseProductForm(fd({ ...base, name: '', category: 'shoes', price: 'abc', retailPrice: '100', stock_M: '-1' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.fieldErrors).sort()).toEqual(['category', 'name', 'price', 'stock_M'])
  })
  it('requires the retail price to be higher than the overrun price', () => {
    const r = parseProductForm(fd({ ...base, retailPrice: '1000' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors.retailPrice).toMatch(/higher/)
  })
  it('requires at least one size', () => {
    const r = parseProductForm(fd({ ...base, stock_M: '', stock_L: '' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors.stock).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/admin`
Expected: FAIL. `./product-form` doesn't exist yet.

- [ ] **Step 3: Implement form parsing**

`src/lib/admin/product-form.ts`:
```ts
import { CATEGORIES, SIZES, type Category, type Size } from '@/lib/catalog/constants'

export const MAX_IMAGES = 8

export function parsePesoToCentavos(input: string): number | null {
  const s = input.replace(/[₱,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

export function centavosToPesoInput(c: number | null): string {
  if (c === null) return ''
  return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2)
}

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}

export type ProductInput = {
  name: string
  slug: string
  description: string
  category: Category
  priceCentavos: number
  retailPriceCentavos: number | null
  images: string[]
  isActive: boolean
  isFeatured: boolean
  stock: Partial<Record<Size, number>>
}

export function parseProductForm(fd: FormData): { ok: true; data: ProductInput } | { ok: false; fieldErrors: Record<string, string> } {
  const str = (k: string) => String(fd.get(k) ?? '').trim()
  const errors: Record<string, string> = {}

  const name = str('name')
  if (name.length < 1 || name.length > 120) errors.name = 'Name is required (max 120 characters).'
  const slug = slugify(str('slug') || name)
  if (name && !slug) errors.slug = 'Use letters or numbers in the name or slug.'

  const categoryRaw = str('category')
  const category = CATEGORIES.find((c) => c.slug === categoryRaw)?.slug
  if (!category) errors.category = 'Pick a category.'

  const priceCentavos = parsePesoToCentavos(str('price'))
  if (!priceCentavos) errors.price = 'Enter a price in pesos, like 690 or 1,299.50.'

  const retailRaw = str('retailPrice')
  const retailPriceCentavos = retailRaw ? parsePesoToCentavos(retailRaw) : null
  if (retailRaw && retailPriceCentavos === null) errors.retailPrice = 'Enter a retail price in pesos, or leave it blank.'
  else if (retailPriceCentavos !== null && priceCentavos && retailPriceCentavos <= priceCentavos) errors.retailPrice = 'Retail price must be higher than the overrun price.'

  let images: string[] = []
  try {
    const parsed: unknown = JSON.parse(str('images') || '[]')
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) images = parsed.slice(0, MAX_IMAGES)
    else errors.images = 'Image list is invalid. Reload and try again.'
  } catch {
    errors.images = 'Image list is invalid. Reload and try again.'
  }

  const stock: Partial<Record<Size, number>> = {}
  for (const size of SIZES) {
    const raw = str(`stock_${size}`)
    if (raw === '') continue
    if (!/^\d{1,5}$/.test(raw)) errors[`stock_${size}`] = 'Whole number, 0 or more.'
    else stock[size] = Number(raw)
  }
  if (Object.keys(stock).length === 0 && !Object.keys(errors).some((k) => k.startsWith('stock_'))) errors.stock = 'Enter stock for at least one size (0 is fine).'

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors }
  return {
    ok: true,
    data: {
      name, slug, description: str('description'), category: category!, priceCentavos: priceCentavos!, retailPriceCentavos,
      images, isActive: fd.get('isActive') === 'on', isFeatured: fd.get('isFeatured') === 'on', stock,
    },
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/admin`
Expected: PASS.

- [ ] **Step 5: Image upload (browser → Supabase Storage, which avoids Vercel's 4.5 MB body limit)**

`src/lib/admin/downscale-image.ts`:
```ts
// Shrinks phone photos (often 4–8 MB) before upload to save Storage space and Vercel image transforms.
export async function downscaleImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality))
}
```

`src/components/admin/image-uploader.tsx`:
```tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'
import { MAX_IMAGES } from '@/lib/admin/product-form'
import { downscaleImage } from '@/lib/admin/downscale-image'
import { PRODUCT_IMAGES_BUCKET, productImageUrl } from '@/lib/catalog/images'
import { createBrowserSupabase } from '@/lib/supabase/browser'

const MAX_SOURCE_BYTES = 20 * 1024 * 1024

export function ImageUploader({ initial }: { initial: string[] }) {
  const [images, setImages] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setBusy(true)
    const supabase = createBrowserSupabase()
    const added: string[] = []
    try {
      for (const file of Array.from(files).slice(0, MAX_IMAGES - images.length)) {
        if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)
        if (file.size > MAX_SOURCE_BYTES) throw new Error(`${file.name} is over 20 MB.`)
        const blob = await downscaleImage(file)
        const path = `products/${crypto.randomUUID()}.jpg`
        const { error: upErr } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
        added.push(path)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setImages((prev) => [...prev, ...added])
      setBusy(false)
    }
  }

  const move = (i: number) => setImages((prev) => [prev[i], ...prev.filter((_, j) => j !== i)])
  const remove = (i: number) => setImages((prev) => prev.filter((_, j) => j !== i))

  return (
    <div className="space-y-3">
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((src, i) => (
          <li key={src} className="space-y-1">
            <div className="relative aspect-square border border-ink bg-card">
              <Image src={productImageUrl(src)} alt="" fill sizes="160px" className="object-cover" />
              {i === 0 ? <span className="absolute left-1 top-1 bg-tag px-1 text-[10px] font-bold uppercase">Cover</span> : null}
            </div>
            <div className="flex justify-between text-xs">
              {i > 0 ? <button type="button" className="underline" onClick={() => move(i)}>Make cover</button> : <span />}
              <button type="button" className="underline" onClick={() => remove(i)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      {images.length < MAX_IMAGES ? (
        <label className="inline-flex h-11 cursor-pointer items-center border border-ink bg-card px-4 text-sm font-semibold">
          {busy ? 'Uploading…' : 'Add photos'}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
        </label>
      ) : null}
      {error ? <p role="alert" className="text-sm font-semibold">{error}</p> : null}
    </div>
  )
}
```

Removing a photo only drops it from the product. The file stays in Storage, which is fine at POC scale.

- [ ] **Step 6: Server action, form and pages**

`src/app/admin/(protected)/products/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { parseProductForm } from '@/lib/admin/product-form'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { Size } from '@/lib/catalog/constants'

export type ProductFormState = { status: 'idle' } | { status: 'invalid'; fieldErrors: Record<string, string> } | { status: 'error'; message: string }

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '') || null
  const parsed = parseProductForm(formData)
  if (!parsed.ok) return { status: 'invalid', fieldErrors: parsed.fieldErrors }
  const p = parsed.data

  const row = {
    slug: p.slug, name: p.name, description: p.description, category: p.category,
    price_centavos: p.priceCentavos, retail_price_centavos: p.retailPriceCentavos, images: p.images,
    is_active: p.isActive, is_featured: p.isFeatured,
  }
  const { data: saved, error } = id
    ? await supabase.from('products').update(row).eq('id', id).select('id').single()
    : await supabase.from('products').insert(row).select('id').single()
  if (error) {
    if (error.code === '23505') return { status: 'invalid', fieldErrors: { slug: 'Another product already uses this slug.' } }
    return { status: 'error', message: error.message }
  }

  const sizes = Object.keys(p.stock) as Size[]
  const { error: upsertError } = await supabase
    .from('product_variants')
    .upsert(sizes.map((size) => ({ product_id: saved.id, size, stock: p.stock[size]! })), { onConflict: 'product_id,size' })
  if (upsertError) return { status: 'error', message: upsertError.message }
  const { error: deleteError } = await supabase.from('product_variants').delete().eq('product_id', saved.id).not('size', 'in', `(${sizes.join(',')})`)
  if (deleteError) return { status: 'error', message: deleteError.message }

  revalidatePath('/')
  revalidatePath('/shop')
  revalidatePath('/product/[slug]', 'page')
  redirect('/admin/products?saved=1')
}
```

`src/components/admin/product-form.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { saveProduct, type ProductFormState } from '@/app/admin/(protected)/products/actions'
import { buttonPrimary, inputBase } from '@/components/ui/styles'
import { centavosToPesoInput } from '@/lib/admin/product-form'
import { CATEGORIES, SIZES, sizeLabel } from '@/lib/catalog/constants'
import type { Product } from '@/lib/catalog/types'
import { ImageUploader } from './image-uploader'

export function ProductForm({ product }: { product: Product | null }) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProduct, { status: 'idle' })
  const e = state.status === 'invalid' ? state.fieldErrors : {}
  const stockFor = (size: string) => product?.variants.find((v) => v.size === size)?.stock
  const Err = ({ k }: { k: string }) => (e[k] ? <p className="text-sm font-semibold text-tag">{e[k]}</p> : null)

  return (
    <form action={action} className="max-w-2xl space-y-6">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {state.status === 'error' ? <p role="alert" className="border border-tag bg-card p-3 text-sm">{state.message}</p> : null}

      <label className="block space-y-1"><span className="text-sm font-semibold">Name</span><input name="name" defaultValue={product?.name} className={inputBase} required /><Err k="name" /></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">URL slug (optional)</span><input name="slug" defaultValue={product?.slug} placeholder="auto from name" className={inputBase} /><Err k="slug" /></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">Description</span><textarea name="description" defaultValue={product?.description} rows={4} className={`${inputBase} h-auto py-2`} /></label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Category</span>
        <select name="category" defaultValue={product?.category ?? ''} className={inputBase}>
          <option value="" disabled>Choose…</option>
          {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </select>
        <Err k="category" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block space-y-1"><span className="text-sm font-semibold">Overrun price (₱)</span><input name="price" inputMode="decimal" defaultValue={centavosToPesoInput(product?.priceCentavos ?? null)} className={inputBase} /><Err k="price" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Retail price (₱, optional)</span><input name="retailPrice" inputMode="decimal" defaultValue={centavosToPesoInput(product?.retailPriceCentavos ?? null)} className={inputBase} /><Err k="retailPrice" /></label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Stock per size (leave blank if the size doesn&apos;t exist)</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {SIZES.map((s) => (
            <label key={s} className="space-y-1 text-center text-xs font-semibold">
              {sizeLabel(s)}
              <input name={`stock_${s}`} inputMode="numeric" defaultValue={stockFor(s) ?? ''} className={`${inputBase} text-center`} />
              <Err k={`stock_${s}`} />
            </label>
          ))}
        </div>
        <Err k="stock" />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Photos (first is the cover)</legend>
        <ImageUploader initial={product?.images ?? []} />
        <Err k="images" />
      </fieldset>

      <div className="flex gap-6">
        <label className="flex h-11 items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} className="h-5 w-5" /> Visible in store</label>
        <label className="flex h-11 items-center gap-2"><input type="checkbox" name="isFeatured" defaultChecked={product?.isFeatured ?? false} className="h-5 w-5" /> Featured on home</label>
      </div>

      <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? 'Saving…' : 'Save product'}</button>
    </form>
  )
}
```

`src/app/admin/(protected)/products/page.tsx`:
```tsx
import Link from 'next/link'
import { buttonPrimary } from '@/components/ui/styles'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listAllProducts } from '@/lib/catalog/queries'
import { totalStock } from '@/lib/catalog/stock'
import { formatPeso } from '@/lib/money'

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { supabase } = await requireAdmin()
  const [products, { saved }] = await Promise.all([listAllProducts(supabase), searchParams])
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Products</h1>
        <Link href="/admin/products/new" className={buttonPrimary}>Add product</Link>
      </div>
      {saved ? <p role="status" className="border border-ink bg-card p-3 text-sm">Saved.</p> : null}
      <table className="w-full border border-ink bg-card text-sm">
        <thead className="border-b border-ink text-left"><tr><th className="p-2">Name</th><th className="p-2">Price</th><th className="p-2">Stock</th><th className="p-2">Status</th></tr></thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b border-ink/20">
              <td className="p-2"><Link href={`/admin/products/${p.id}`} className="font-semibold underline">{p.name}</Link></td>
              <td className="p-2">{formatPeso(p.priceCentavos)}</td>
              <td className="p-2">{totalStock(p)} <span className="text-muted">({p.variants.map((v) => `${v.size}:${v.stock}`).join(' ')})</span></td>
              <td className="p-2">{p.isActive ? 'Visible' : <span className="text-muted">Hidden</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

`src/app/admin/(protected)/products/new/page.tsx`:
```tsx
import { ProductForm } from '@/components/admin/product-form'

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Add product</h1>
      <ProductForm product={null} />
    </div>
  )
}
```

`src/app/admin/(protected)/products/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { ProductForm } from '@/components/admin/product-form'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getProductById } from '@/lib/catalog/queries'
import { isUuid } from '@/lib/orders/queries'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { supabase } = await requireAdmin()
  const product = await getProductById(supabase, id)
  if (!product) notFound()
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Edit {product.name}</h1>
      <ProductForm product={product} />
    </div>
  )
}
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.
In dev as the admin:
- Add a product with 2 phone photos, stock M=2, L=0, and a retail price. It appears on `/shop` with the struck-through price, and L is crossed out on the product page.
- Edit it to hide it. It disappears from `/shop`, and `/product/<slug>` gives a 404.
- Duplicating a slug shows "Another product already uses this slug."
- In a private window, signed out, run `curl -X POST` against the products page. The server action is protected by `requireAdmin`; confirm a signed-out action call redirects rather than writing.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(admin): product create/edit with photo upload and per-size stock"
```

---

### Task 12: Admin orders

**Files:**
- Create: `src/lib/admin/order-status.ts`, `src/components/admin/status-badge.tsx`, `src/app/admin/(protected)/orders/{page.tsx,[id]/page.tsx,actions.ts}`
- Test: `src/lib/admin/order-status.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`; `getOrderDetail`, `isUuid`, `OrderDetail`; `formatOrderNumber`, `formatManilaDate`; `OrderStatus`.
- Produces: `nextStatuses(s: OrderStatus): OrderStatus[]`, `canTransition(from, to): boolean`, `ORDER_STATUSES`, `updateOrderStatus(formData)` server action, `<StatusBadge status>`.

- [ ] **Step 1: Write the failing test**

`src/lib/admin/order-status.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { canTransition, nextStatuses } from './order-status'

describe('order status transitions', () => {
  it('lets the owner ship paid orders and cancel unpaid ones', () => {
    expect(nextStatuses('pending')).toEqual(['cancelled'])
    expect(nextStatuses('paid')).toEqual(['shipped'])
    expect(nextStatuses('shipped')).toEqual([])
    expect(nextStatuses('cancelled')).toEqual([])
  })
  it('blocks marking orders paid by hand (only the webhook does that)', () => {
    expect(canTransition('pending', 'paid')).toBe(false)
    expect(canTransition('paid', 'shipped')).toBe(true)
    expect(canTransition('shipped', 'pending')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- order-status`
Expected: FAIL. `./order-status` doesn't exist yet.

- [ ] **Step 3: Implement**

`src/lib/admin/order-status.ts`:
```ts
import type { OrderStatus } from '@/lib/catalog/constants'

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'cancelled'] as const satisfies readonly OrderStatus[]

// Refunds for paid orders happen in the PayMongo dashboard, so paid → cancelled is out of scope for the POC.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['cancelled'],
  paid: ['shipped'],
  shipped: [],
  cancelled: [],
}

export const nextStatuses = (s: OrderStatus) => TRANSITIONS[s]
export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to)
```

`src/components/admin/status-badge.tsx`:
```tsx
import type { OrderStatus } from '@/lib/catalog/constants'

const styles: Record<OrderStatus, string> = {
  pending: 'bg-paper text-muted border-muted',
  paid: 'bg-tag text-ink border-ink',
  shipped: 'bg-ink text-paper border-ink',
  cancelled: 'bg-card text-muted border-muted line-through',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-block border px-2 py-0.5 text-xs font-bold uppercase ${styles[status]}`}>{status}</span>
}
```

`src/app/admin/(protected)/orders/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { canTransition, ORDER_STATUSES } from '@/lib/admin/order-status'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { OrderStatus } from '@/lib/catalog/constants'

const isStatus = (s: string): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s)

export async function updateOrderStatus(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const from = String(formData.get('from') ?? '')
  const to = String(formData.get('to') ?? '')
  if (!isStatus(from) || !isStatus(to) || !canTransition(from, to)) throw new Error(`Can't move an order from ${from} to ${to}.`)
  // The status guard makes a stale double-click a no-op instead of a wrong transition.
  const { error } = await supabase.from('orders').update({ status: to }).eq('id', id).eq('status', from)
  if (error) throw error
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${id}`)
}
```

`src/app/admin/(protected)/orders/page.tsx`:
```tsx
import Link from 'next/link'
import { StatusBadge } from '@/components/admin/status-badge'
import { ORDER_STATUSES } from '@/lib/admin/order-status'
import { requireAdmin } from '@/lib/auth/require-admin'
import { formatPeso } from '@/lib/money'
import { formatManilaDate, formatOrderNumber } from '@/lib/orders/format'

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase } = await requireAdmin()
  const { status } = await searchParams
  const filter = ORDER_STATUSES.find((s) => s === status) ?? null
  let query = supabase.from('orders').select('id, customer_name, total_centavos, status, oversold, created_at').order('created_at', { ascending: false }).limit(200)
  if (filter) query = query.eq('status', filter)
  const { data: orders, error } = await query
  if (error) throw error

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Orders</h1>
      <nav className="flex flex-wrap gap-2 text-sm">
        {[null, ...ORDER_STATUSES].map((s) => (
          <Link key={s ?? 'all'} href={s ? `/admin/orders?status=${s}` : '/admin/orders'} className={`flex h-11 items-center border border-ink px-3 uppercase ${filter === s ? 'bg-ink text-paper' : 'bg-card'}`}>{s ?? 'All'}</Link>
        ))}
      </nav>
      {orders.length === 0 ? <p className="text-muted">No orders yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border border-ink bg-card text-sm">
            <thead className="border-b border-ink text-left"><tr><th className="p-2">Order #</th><th className="p-2">Customer</th><th className="p-2">Total</th><th className="p-2">Status</th><th className="p-2">Date</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-ink/20">
                  <td className="p-2"><Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold underline">{formatOrderNumber(o.id)}</Link></td>
                  <td className="p-2">{o.customer_name}</td>
                  <td className="p-2">{formatPeso(o.total_centavos)}</td>
                  <td className="p-2"><StatusBadge status={o.status} />{o.oversold ? <span className="ml-2 border border-tag px-1 text-xs font-bold uppercase">Oversold</span> : null}</td>
                  <td className="p-2 text-muted">{formatManilaDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

`src/app/admin/(protected)/orders/[id]/page.tsx`:
```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StatusBadge } from '@/components/admin/status-badge'
import { buttonPrimary, buttonSecondary } from '@/components/ui/styles'
import { nextStatuses } from '@/lib/admin/order-status'
import { requireAdmin } from '@/lib/auth/require-admin'
import { sizeLabel } from '@/lib/catalog/constants'
import { formatPeso } from '@/lib/money'
import { formatManilaDate, formatOrderNumber } from '@/lib/orders/format'
import { getOrderDetail } from '@/lib/orders/queries'
import { updateOrderStatus } from '../actions'

const actionLabel = { shipped: 'Mark as shipped', cancelled: 'Cancel order', paid: '', pending: '' } as const

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin()
  const order = await getOrderDetail(supabase, (await params).id)
  if (!order) notFound()
  const a = order.address
  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/orders" className="text-sm underline">← All orders</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl">Order {formatOrderNumber(order.id)}</h1>
        <StatusBadge status={order.status} />
      </div>
      {order.oversold ? (
        <p role="alert" className="border border-tag bg-card p-3 text-sm">
          This order was paid after stock ran out. Check the shelf before shipping, and refund it in the PayMongo dashboard if the item isn&apos;t there.
        </p>
      ) : null}
      <p className="text-sm text-muted">Placed {formatManilaDate(order.createdAt)}</p>
      <section className="space-y-1 border border-ink bg-card p-4 text-sm">
        <p className="font-semibold">{order.customerName}</p>
        <p>{order.phone} · {order.email}</p>
        {a ? <p className="text-muted">{a.street}, {a.barangay}, {a.city}, {a.province} {a.zip}</p> : null}
      </section>
      <ul className="divide-y divide-ink border-y border-ink text-sm">
        {order.items.map((i, idx) => <li key={idx} className="flex justify-between py-2"><span>{i.qty} × {i.productName} ({sizeLabel(i.size)})</span><span>{formatPeso(i.qty * i.priceCentavos)}</span></li>)}
        <li className="flex justify-between py-2 text-muted"><span>Shipping</span><span>{formatPeso(order.shippingCentavos)}</span></li>
        <li className="flex justify-between py-2 font-bold"><span>Total</span><span>{formatPeso(order.totalCentavos)}</span></li>
      </ul>
      <div className="flex gap-3">
        {nextStatuses(order.status).map((to) => (
          <form key={to} action={updateOrderStatus}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="from" value={order.status} />
            <input type="hidden" name="to" value={to} />
            <button type="submit" className={to === 'shipped' ? buttonPrimary : buttonSecondary}>{actionLabel[to]}</button>
          </form>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS.
In dev as admin: `/admin/orders` lists the Task 7–9 orders, newest first, with status badges. Filter by Paid. Open a paid order and click "Mark as shipped": the badge updates and the buttons disappear. To see an oversold order, set a variant's stock to 0 in Studio, simulate the webhook for a pending order containing it, and confirm the "Oversold" badge and alert show.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): orders list, detail and status transitions"
```

---

### Task 13: Cloud setup, deploy and demo run-through

> Every step here creates accounts or publishes to external services. Confirm each one with the user before running it.

**Files:**
- Create: `README.md` (setup and runbook)

- [ ] **Step 1: Supabase cloud project**

Create a free project at https://supabase.com/dashboard in region **Southeast Asia (Singapore)**. Then:
```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push --include-seed
```
In the dashboard, go to Authentication → Providers → Email, turn off "Allow new users to sign up", and under Users click Add user (auto-confirm) for the owner. In the SQL editor, run the `insert into public.admins …` statement from Task 10.

- [ ] **Step 2: GitHub and Vercel**

```bash
gh repo create overruns-store --private --source . --push
npx vercel link
```
Add env vars to the Vercel project (Production and Preview) with `npx vercel env add <NAME>`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SHIPPING_FEE_CENTAVOS=15000`, `PAYMONGO_SECRET_KEY` (sk_test), `PAYMONGO_PAYMENT_METHODS`, `EMAIL_FROM`, and `NEXT_PUBLIC_SITE_URL=https://<project>.vercel.app`. Deploy with `npx vercel --prod` and note the URL.

- [ ] **Step 3: Register the PayMongo webhook**

```bash
curl -s https://api.paymongo.com/v1/webhooks \
  -u "$PAYMONGO_SECRET_KEY:" -H 'Content-Type: application/json' \
  -d '{"data":{"attributes":{"url":"https://<project>.vercel.app/api/webhooks/paymongo","events":["checkout_session.payment.paid"]}}}'
```
Copy `data.attributes.secret_key` (`whsk_…`) into Vercel as `PAYMONGO_WEBHOOK_SECRET` and redeploy.

- [ ] **Step 4: Resend**

Create a free account at https://resend.com, create an API key, and add `RESEND_API_KEY` to Vercel. **Limitation:** without a verified domain, Resend only delivers mail sent from `onboarding@resend.dev` to the account owner's own email. For the demo, either check out using that email, or verify a domain (the spec has no domain for the POC, so flag this to the client). Redeploy.

- [ ] **Step 5: Demo run-through on a real phone (the spec's Done-when list)**

- [ ] Find a product, pick a size, add it to the cart.
- [ ] A sold-out size can't be selected (try `crewneck-sweatshirt-grey`, or XL of the Oxford).
- [ ] Check out and pay with PayMongo's test GCash flow. Repeat once with a test card from PayMongo's testing docs. Each order shows **paid** in `/admin/orders`, and that size's stock dropped.
- [ ] The confirmation email arrives (to the Resend owner email, per Step 4).
- [ ] The owner adds a product with photos from their phone, and it appears in `/shop` within a minute.
- [ ] In the PayMongo dashboard → Webhooks, the deliveries show `200`.

- [ ] **Step 6: README runbook**

Write `README.md` covering: prerequisites; local setup (`npm i`, `npx supabase start`, copy keys to `.env.local`, `npm run dev`); tests (`npm test`, `npm run test:db`, `npm run test:integration`); simulating payments locally (`scripts/simulate-paymongo-webhook.ts`); creating the admin user; deploy steps from this task; and the **before-each-demo checklist**: open the Supabase dashboard if the project has been idle for close to 7 days (free projects pause), then do one test purchase. Also list the spec's "Before launch" items: Vercel Pro, Supabase Pro, a custom domain plus Resend domain verification, and PayMongo live keys.

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: setup, deploy and demo runbook"
git push
```
