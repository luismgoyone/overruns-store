'use client'

import { useRouter } from 'next/navigation'
import { monoLabel } from '@/components/ui/styles'

/**
 * Goes back when the visitor arrived from another page of this store (keeps their
 * shop filters and scroll position); otherwise, e.g. when they landed from
 * Instagram, goes to `fallbackHref` instead of leaving the site.
 */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter()
  function goBack() {
    const fromThisStore = document.referrer.startsWith(window.location.origin)
    if (fromThisStore && window.history.length > 1) router.back()
    else router.push(fallbackHref)
  }
  return (
    <button type="button" onClick={goBack} className={`inline-flex min-h-11 items-center gap-2 text-ink hover:text-tag-ink ${monoLabel}`}>
      <span aria-hidden="true">←</span>
      Back
    </button>
  )
}
