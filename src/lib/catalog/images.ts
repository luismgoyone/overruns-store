export const PRODUCT_IMAGES_BUCKET = 'product-images'

export function productImageUrl(path: string): string {
  if (/^https?:\/\//.test(path) || path.startsWith('/demo/')) return path
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${encoded}`
}
