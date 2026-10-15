import Image from 'next/image'
import Link from 'next/link'
import { CategoryChips } from '@/components/catalog/category-chips'
import { ProductGrid } from '@/components/catalog/product-grid'
import { buttonPrimary } from '@/components/ui/styles'
import { listFeatured, listLatest } from '@/lib/catalog/queries'
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '@/lib/config'
import { createPublicClient } from '@/lib/supabase/public'

export const revalidate = 60

export default async function HomePage() {
  const db = createPublicClient()
  const [latest, featured] = await Promise.all([listLatest(db, 6), listFeatured(db, 4)])
  return (
    <>
      <section className="relative border-b border-ink">
        <div className="relative aspect-[4/5] sm:aspect-[16/7]">
          <Image src="https://picsum.photos/seed/overruns-warehouse/1600/1000" alt="Folded clothing on a warehouse shelf" fill priority sizes="100vw" className="object-cover" />
        </div>
        <div className="absolute inset-x-0 bottom-0 space-y-4 bg-gradient-to-t from-ink/80 to-transparent p-4 pt-24 text-paper sm:p-8">
          <h1 className="font-display text-4xl leading-none sm:text-6xl">Real brands.<br />Overrun prices.</h1>
          <Link href="/shop" className={buttonPrimary}>Shop the drop</Link>
        </div>
      </section>

      <CategoryChips />

      <section className="space-y-4 py-4">
        <h2 className="px-4 font-display text-xl">Latest drop</h2>
        <ProductGrid products={latest} />
      </section>

      {featured.length > 0 ? (
        <section className="space-y-4 py-4">
          <h2 className="px-4 font-display text-xl">Featured</h2>
          <ProductGrid products={featured} />
        </section>
      ) : null}

      <section className="mx-4 my-8 space-y-2 border border-ink bg-card p-6">
        <h2 className="font-display text-lg">What&apos;s an overrun?</h2>
        <p className="text-muted">Factories make extra pieces to cover defects and delays. The extras that pass QC are authentic, brand-new items we sell below retail.</p>
        <Link href="/about" className="inline-flex h-11 items-center font-semibold underline">Learn more</Link>
      </section>

      <section className="px-4 py-4 text-center">
        <a href={INSTAGRAM_URL} className="inline-flex h-11 items-center font-display text-sm underline">Follow @{INSTAGRAM_HANDLE}</a>
      </section>
    </>
  )
}
