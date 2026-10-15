import Link from 'next/link'
import { signOut } from '@/app/admin/login/actions'
import { requireAdmin } from '@/lib/auth/require-admin'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin()
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-ink bg-card p-4 md:border-b-0 md:border-r">
        <p className="font-display text-sm">Overruns admin</p>
        <nav className="mt-4 flex gap-2 md:flex-col">
          <Link href="/admin/orders" className="flex h-11 items-center px-2 font-semibold hover:bg-paper">Orders</Link>
          <Link href="/admin/products" className="flex h-11 items-center px-2 font-semibold hover:bg-paper">Products</Link>
          <Link href="/" className="flex h-11 items-center px-2 text-muted hover:bg-paper">View store</Link>
        </nav>
        <form action={signOut} className="mt-6 text-sm text-muted">
          <p className="truncate">{user.email}</p>
          <button type="submit" className="h-11 underline">Sign out</button>
        </form>
      </aside>
      <main className="p-4 md:p-8">{children}</main>
    </div>
  )
}
