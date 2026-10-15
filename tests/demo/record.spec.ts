import { mkdir, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_SHOPPER_EMAIL } from './support/env'
import { cleanUpDemoData, seedDemoData } from './support/demo-data'

const VIEWPORT = { width: 1280, height: 800 }
const OUT = 'test-results/demo/overruns-store'
const PRODUCT = { slug: 'heavyweight-tee-black', name: 'Heavyweight Tee', size: 'M' }

// Resolves once every image that's on screen has loaded and fonts are ready, so nothing pops in on camera.
async function settled(p: Page) {
  await p.waitForLoadState('load')
  await p.evaluate(() => document.fonts.ready)
  await p.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => {
        const r = img.getBoundingClientRect()
        return r.width > 0 && r.bottom > 0 && r.top < innerHeight
      })
      .every((img) => img.complete && img.naturalWidth > 0),
  )
}

test.beforeAll(async () => {
  await seedDemoData()
})

test.afterAll(async () => {
  await cleanUpDemoData()
})

/**
 * A ~15s tour for the portfolio site: storefront → product → size → cart →
 * checkout → (mock) PayMongo → order confirmed → admin orders.
 * Writes `overruns-store.webm` plus `overruns-store.json` (seconds of lead-in to trim).
 */
test('record the Overruns Project store demo', async ({ browser, context, page }) => {
  // Off camera: sign the demo admin in, and warm every page and image the tour shows.
  await page.setViewportSize(VIEWPORT)
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(DEMO_ADMIN_EMAIL)
  await page.getByLabel('Password').fill(DEMO_ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
  for (const path of ['/', `/product/${PRODUCT.slug}`]) {
    await page.goto(path)
    await settled(page)
  }
  await page.getByRole('button', { name: PRODUCT.size, exact: true }).click()
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await page.goto('/cart')
  await settled(page)
  await page.goto('/checkout')
  await settled(page)

  const rec = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: OUT, size: VIEWPORT } })
  await rec.addCookies(await context.cookies())
  const started = Date.now()
  const p = await rec.newPage()
  const pause = (ms: number) => p.waitForTimeout(ms)

  // 1. Storefront
  await p.goto('/')
  await expect(p.getByRole('heading', { level: 1, name: /Real brands/ })).toBeVisible()
  await settled(p)
  const leadIn = (Date.now() - started) / 1000
  const mark = (step: string) => console.log(`[demo] ${((Date.now() - started) / 1000).toFixed(1)}s ${step}`)
  await pause(1800)
  await p.mouse.wheel(0, 640)
  await settled(p)
  await pause(1300)

  // 2. Product, size, add to cart
  mark('product')
  await p.getByRole('link', { name: new RegExp(PRODUCT.name) }).first().click()
  await expect(p.getByRole('heading', { level: 1, name: PRODUCT.name })).toBeVisible()
  await settled(p)
  await pause(900)
  await p.getByRole('button', { name: PRODUCT.size, exact: true }).click()
  await pause(500)
  await p.getByRole('button', { name: 'Add to cart' }).click()
  await expect(p.getByRole('status').filter({ hasText: 'Added to cart' })).toBeVisible()
  await pause(800)

  // 3. Cart → checkout
  mark('cart')
  await p.getByRole('link', { name: /^Cart, 1 item/ }).first().click()
  await expect(p.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible()
  await settled(p)
  await pause(1000)
  await p.getByRole('link', { name: 'Checkout' }).click()
  await expect(p.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible()
  await settled(p)
  await pause(300)
  await p.getByLabel('Full name').pressSequentially('Andrea Santos', { delay: 30 })
  await p.getByLabel('Mobile number').pressSequentially('0917 555 0123', { delay: 20 })
  // The rest (partly below the fold) is filled at once so the clip stays short.
  await p.getByLabel('Email').fill(DEMO_SHOPPER_EMAIL)
  await p.getByLabel('House no., street, building').fill('12 Mabini St.')
  await p.getByLabel('Barangay').fill('San Antonio')
  await p.getByLabel('City / municipality').fill('Pasig')
  await p.getByLabel('Province').fill('Metro Manila')
  await p.getByLabel('ZIP code').fill('1600')
  await p.evaluate(() => scrollTo({ top: 0 }))
  await pause(600)

  // 4. Pay (mock PayMongo marks it paid via the signed webhook) → confirmation
  mark('pay')
  await p.getByRole('button', { name: 'Pay with PayMongo' }).click()
  await expect(p.getByRole('heading', { level: 1, name: /order is confirmed/ })).toBeVisible({ timeout: 20_000 })
  await settled(p)
  await pause(2200)

  // 5. Admin: the new order is at the top, paid
  mark('admin')
  await p.goto('/admin/orders')
  await expect(p.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible()
  await expect(p.getByRole('row').nth(1)).toContainText('Andrea Santos')
  await settled(p)
  // Playwright keeps recording ~2s after this while the context closes, so the hold is short.
  await pause(1400)

  mark('end')
  const video = p.video()!
  await rec.close()
  await video.saveAs(`${OUT}.webm`)
  await mkdir('test-results/demo', { recursive: true })
  await writeFile(`${OUT}.json`, JSON.stringify({ leadIn }, null, 2))
})
