'use client'

import { useEffect } from 'react'
import { buttonInk } from './styles'

/** Friendly fallback for error.tsx boundaries. The free-tier database can take a moment to wake up. */
export function ErrorState({ error, retry, homeHref = '/' }: { error: Error & { digest?: string }; retry: () => void; homeHref?: string }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.15em] text-tag-ink">Error</p>
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="text-muted">The store may be waking up. Give it a few seconds and try again.</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button type="button" onClick={() => retry()} className={buttonInk}>Try again</button>
        <a href={homeHref} className="inline-flex h-12 items-center px-3 font-mono text-sm font-bold uppercase tracking-[0.15em] underline-offset-4 hover:underline">Go home</a>
      </div>
      {error.digest ? <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Ref {error.digest}</p> : null}
    </div>
  )
}
