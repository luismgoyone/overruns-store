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
