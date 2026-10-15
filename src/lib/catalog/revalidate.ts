import 'server-only'
import { revalidatePath } from 'next/cache'

/** Stock or products changed: refresh the cached catalog pages. Only valid in route handlers and server actions. */
export function revalidateCatalog() {
  revalidatePath('/')
  revalidatePath('/shop')
  revalidatePath('/product/[slug]', 'page')
}
