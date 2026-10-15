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
