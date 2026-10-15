import Link from 'next/link'
import { buttonInk } from '@/components/ui/styles'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.15em] text-tag-ink">404</p>
      <h1 className="font-display text-3xl">Not found</h1>
      <p className="text-muted">This item may have sold out or been removed.</p>
      <Link href="/shop" className={buttonInk}>Back to the shop</Link>
    </main>
  )
}
