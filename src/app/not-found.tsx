import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-20 text-center">
      <h1 className="font-display text-2xl">Not found</h1>
      <p className="text-muted">This item may have sold out or been removed.</p>
      <Link href="/shop" className="inline-flex h-11 items-center font-semibold underline">Back to the shop</Link>
    </main>
  )
}
