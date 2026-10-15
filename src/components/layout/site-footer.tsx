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
    <footer className="mt-20 bg-ink text-paper">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-lg">The Overruns Project</p>
          <ul className="grid grid-cols-3 gap-x-4 sm:flex sm:gap-6">
            {links.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="inline-flex h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-paper/80 hover:text-paper hover:underline hover:underline-offset-4">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 border-t border-paper/20 pt-6 font-mono text-[11px] uppercase tracking-[0.15em] text-paper/70 sm:flex-row sm:justify-between">
          <p>
            <a href={INSTAGRAM_URL} className="underline underline-offset-4 hover:text-paper">@{INSTAGRAM_HANDLE}</a> · Authentic overruns, limited stock.
          </p>
          <p>Payments by PayMongo: GCash, Maya, cards</p>
        </div>
      </div>
    </footer>
  )
}
