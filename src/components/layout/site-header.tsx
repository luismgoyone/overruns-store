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
