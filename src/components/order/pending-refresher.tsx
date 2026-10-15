'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

// The webhook may land a few seconds after PayMongo redirects back; poll briefly.
export function PendingRefresher({ intervalMs = 3000, maxTries = 20 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter()
  const [tries, setTries] = useState(0)
  useEffect(() => {
    if (tries >= maxTries) return
    const t = setTimeout(() => {
      router.refresh()
      setTries((n) => n + 1)
    }, intervalMs)
    return () => clearTimeout(t)
  }, [tries, maxTries, intervalMs, router])
  return (
    <p role="status" className="text-muted">
      {tries >= maxTries ? "Still waiting on PayMongo. We'll email you as soon as your payment is confirmed." : 'Confirming your payment…'}
    </p>
  )
}
