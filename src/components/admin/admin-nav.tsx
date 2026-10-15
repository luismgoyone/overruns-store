'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin" className="flex gap-1 md:flex-col">
      {items.map((i) => {
        const active = pathname === i.href || pathname.startsWith(`${i.href}/`)
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? 'page' : undefined}
            className={`flex h-11 items-center px-3 font-mono text-xs uppercase tracking-[0.15em] transition-colors md:h-12 md:px-4 ${active ? 'bg-ink font-bold text-paper' : 'text-ink hover:bg-paper'}`}
          >
            {i.label}
          </Link>
        )
      })}
    </nav>
  )
}
