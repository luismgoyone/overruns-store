'use client'

import { ErrorState } from '@/components/ui/error-state'
import './globals.css'

// Replaces the root layout when it fails, so it brings its own <html>/<body> and styles.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-PH">
      <body className="min-h-dvh antialiased">
        <title>Something went wrong · The Overruns Project</title>
        <ErrorState error={error} retry={retry} />
      </body>
    </html>
  )
}
