import Image from 'next/image'
import Link from 'next/link'
import { CategoryChips } from '@/components/catalog/category-chips'
import { ProductGrid } from '@/components/catalog/product-grid'
import { buttonInk, buttonPrimary, buttonSecondary, eyebrow } from '@/components/ui/styles'
import { listFeatured, listLatest } from '@/lib/catalog/queries'
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '@/lib/config'
import { createPublicClient } from '@/lib/supabase/public'

export const revalidate = 60

function SectionHeading({ title, label, href }: { title: string; label?: string; href?: string }) {
  return (
    <div className="mx-4 flex items-end justify-between gap-4 border-b border-hairline pb-3 sm:mx-8">
      <div className="space-y-1">
        {label ? <p className={eyebrow}>{label}</p> : null}
        <h2 className="font-display text-2xl">{title}</h2>
      </div>
      {href ? <Link href={href} className="inline-flex h-11 items-center font-mono text-xs font-bold uppercase tracking-[0.15em] text-tag-ink hover:underline hover:underline-offset-4">View all →</Link> : null}
    </div>
  )
}

export default async function HomePage() {
  const db = createPublicClient()
  const [latest, featured] = await Promise.all([listLatest(db, 6), listFeatured(db, 4)])
  return (
    <>
      <section className="sm:px-8 sm:pt-10">
        <div className="flex flex-col-reverse border-b border-hairline bg-card sm:grid sm:grid-cols-2 sm:border">
          <div className="flex flex-col justify-center gap-5 p-6 sm:p-10 lg:p-14">
            <p className={eyebrow}>New drop every Friday</p>
            <h1 className="font-display text-[2.75rem] leading-[0.95] lg:text-6xl">Real brands.<br />Overrun prices.</h1>
            <p className="max-w-md text-muted">Authentic factory-surplus clothing in the Philippines. Brand-new pieces from the extra production run, below retail.</p>
            <div>
              <span className="sm:hidden"><Link href="/shop" className={`${buttonPrimary} w-full`}>Shop the drop →</Link></span>
              <span className="hidden sm:inline"><Link href="/shop" className={buttonInk}>Shop the drop</Link></span>
            </div>
          </div>
          <div className="relative aspect-[4/3] bg-paper sm:aspect-auto sm:min-h-[420px]">
            <Image src="https://picsum.photos/seed/overruns-warehouse/1600/1000" alt="Folded clothing on a warehouse shelf" fill priority sizes="(min-width: 640px) 50vw, 100vw" className="object-cover grayscale-[30%]" />
          </div>
        </div>
      </section>

      <div className="pt-6 sm:pt-8"><CategoryChips /></div>

      <section className="space-y-5 pt-10">
        <SectionHeading title="Latest drop" label={`${latest.length} ${latest.length === 1 ? 'piece' : 'pieces'}`} href="/shop" />
        <ProductGrid products={latest} className="px-4 sm:px-8 lg:grid-cols-3" />
      </section>

      {featured.length > 0 ? (
        <section className="space-y-5 pt-14">
          <SectionHeading title="Featured" />
          <ProductGrid products={featured} />
        </section>
      ) : null}

      <section className="mx-4 mt-14 flex flex-col gap-6 border border-hairline bg-card p-6 sm:mx-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div className="max-w-2xl space-y-3">
          <p className={eyebrow}>The short version</p>
          <h2 className="font-display text-2xl">What&apos;s an overrun?</h2>
          <p className="text-muted">Factories make extra pieces to cover defects and delays. The extras that pass QC are authentic, brand-new items we sell below retail.</p>
        </div>
        <Link href="/about" className={`${buttonSecondary} shrink-0`}>Learn more</Link>
      </section>

      <section className="mx-4 mt-14 flex flex-col items-start gap-4 border-t border-hairline pt-6 sm:mx-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-display text-2xl">On Instagram</h2>
          <p className="text-muted">Follow along for new drops.</p>
        </div>
        <a href={INSTAGRAM_URL} className="inline-flex h-11 items-center border border-ink px-4 font-mono text-xs font-bold uppercase tracking-[0.15em] hover:bg-ink hover:text-paper">Follow @{INSTAGRAM_HANDLE}</a>
      </section>
    </>
  )
}
