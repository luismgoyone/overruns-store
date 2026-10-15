'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useActionState } from 'react'
import { buttonInk, inputBase, monoLabel } from '@/components/ui/styles'
import { signIn } from './actions'

function LoginForm() {
  const params = useSearchParams()
  const [state, action, pending] = useActionState(signIn, {})
  const notAdmin = params.get('error') === 'not-admin'
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={params.get('next') ?? '/admin'} />
      {notAdmin ? <p role="alert" className="border border-ink bg-paper p-3 text-sm">That account isn&apos;t an admin.</p> : null}
      {state.error ? <p role="alert" className="border border-tag bg-tag/10 p-3 text-sm">{state.error}</p> : null}
      <label className="block space-y-1.5"><span className={`block ${monoLabel}`}>Email</span><input name="email" type="email" autoComplete="username" required className={inputBase} /></label>
      <label className="block space-y-1.5"><span className={`block ${monoLabel}`}>Password</span><input name="password" type="password" autoComplete="current-password" required className={inputBase} /></label>
      <button type="submit" disabled={pending} className={`${buttonInk} w-full`}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6 border border-ink bg-card p-6 sm:p-10">
        <div className="flex items-start justify-between gap-4 border-b border-hairline pb-5">
          <div className="space-y-1">
            <h1 className="font-display text-2xl leading-tight">The Overruns Project</h1>
            <p className={`${monoLabel} text-muted`}>Store admin</p>
          </div>
          <span className="bg-ink px-2 py-1 font-mono text-[11px] uppercase tracking-[0.15em] text-paper">Admin</span>
        </div>
        <Suspense><LoginForm /></Suspense>
        <p className="border-t border-hairline pt-4 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-muted">Owner access only.</p>
      </div>
    </main>
  )
}
