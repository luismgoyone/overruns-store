import Link from 'next/link'
import { signOut } from '@/app/admin/login/actions'
import { AdminNav } from '@/components/admin/admin-nav'
import { requireAdmin } from '@/lib/auth/require-admin'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin()
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-4 border-b border-hairline bg-card p-4 md:sticky md:top-0 md:h-dvh md:gap-8 md:border-b-0 md:border-r md:p-6">
        <div className="flex items-center justify-between gap-4 md:block md:space-y-1">
          <Link href="/admin" className="font-display text-base leading-tight">The Overruns Project</Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Admin</p>
        </div>
        <AdminNav />
        <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3 md:mt-auto md:block md:space-y-2 md:pt-4">
          <p className="min-w-0 truncate text-sm text-muted">{user.email}</p>
          <div className="flex items-center gap-4">
            <form action={signOut}>
              <button type="submit" className="h-11 font-mono text-xs font-bold uppercase tracking-[0.15em] underline-offset-4 hover:underline">Sign out</button>
            </form>
            <Link href="/" className="flex h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-muted underline-offset-4 hover:underline">View store</Link>
          </div>
        </div>
      </aside>
      <main className="min-w-0 p-4 md:p-10">{children}</main>
    </div>
  )
}
