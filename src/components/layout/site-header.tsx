import Link from 'next/link'
import { CartLink } from '@/components/cart/cart-link'
import { SHIPPING_FEE_CENTAVOS } from '@/lib/config'
import { formatPeso } from '@/lib/money'

const navLink = 'flex h-11 items-center px-3 font-mono text-xs uppercase tracking-[0.15em] hover:underline hover:underline-offset-4'

export function SiteHeader() {
  return (
    <>
      <div className="bg-ink px-4 py-2 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-paper">
        Flat {formatPeso(SHIPPING_FEE_CENTAVOS)} shipping nationwide<span className="hidden sm:inline"> | New drop every Friday</span>
      </div>
      <header className="sticky top-0 z-30 border-b border-hairline bg-paper">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto] items-center px-4 sm:grid-cols-[1fr_auto_1fr] sm:px-8">
          <Link href="/" className="flex h-11 items-center font-display text-base tracking-tight sm:text-lg">The Overruns Project</Link>
          <nav aria-label="Main" className="flex items-center sm:justify-center">
            <Link href="/shop" className={navLink}>Shop</Link>
            <span className="hidden sm:inline"><Link href="/about" className={navLink}>About</Link></span>
            <span className="sm:hidden"><CartLink /></span>
          </nav>
          <div className="hidden justify-end sm:flex"><CartLink /></div>
        </div>
      </header>
    </>
  )
}
