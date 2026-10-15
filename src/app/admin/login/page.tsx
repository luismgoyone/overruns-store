'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useActionState } from 'react'
import { buttonPrimary, inputBase } from '@/components/ui/styles'
import { signIn } from './actions'

function LoginForm() {
  const params = useSearchParams()
  const [state, action, pending] = useActionState(signIn, {})
  const notAdmin = params.get('error') === 'not-admin'
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={params.get('next') ?? '/admin'} />
      {notAdmin ? <p role="alert" className="border border-ink bg-card p-3 text-sm">That account isn&apos;t an admin.</p> : null}
      {state.error ? <p role="alert" className="border border-tag bg-card p-3 text-sm">{state.error}</p> : null}
      <label className="block space-y-1"><span className="text-sm font-semibold">Email</span><input name="email" type="email" autoComplete="username" required className={inputBase} /></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">Password</span><input name="password" type="password" autoComplete="current-password" required className={inputBase} /></label>
      <button type="submit" disabled={pending} className={`${buttonPrimary} w-full`}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm space-y-6 px-4 py-16">
      <h1 className="font-display text-2xl">Store admin</h1>
      <Suspense><LoginForm /></Suspense>
    </main>
  )
}
