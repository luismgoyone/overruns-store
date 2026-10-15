import type { Metadata } from 'next'
import { eyebrow } from '@/components/ui/styles'
import { SHIPPING_FEE_CENTAVOS } from '@/lib/config'
import { formatPeso } from '@/lib/money'

export const metadata: Metadata = { title: 'About' }

export default function AboutPage() {
  return (
    <article className="max-w-3xl space-y-6 px-4 pt-8 leading-relaxed sm:px-8 lg:pt-12">
      <div className="space-y-1 border-b border-hairline pb-5">
        <p className={eyebrow}>What we do</p>
        <h1 className="font-display text-3xl lg:text-5xl">About the project</h1>
      </div>
      <p>The Overruns Project sells authentic branded clothing from factory overruns: the extra pieces a factory makes beyond a brand&apos;s order. They&apos;re brand-new, pass the same quality checks, and cost a fraction of retail.</p>
      <h2 id="faq" className="scroll-mt-24 border-t border-hairline pt-6 font-display text-xl">Are they real?</h2>
      <p>Yes. Overruns come off the same lines as retail stock. Labels may be cut or marked to separate them from retail inventory.</p>
      <h2 className="scroll-mt-24 border-t border-hairline pt-6 font-display text-xl">Why limited sizes?</h2>
      <p>Each run leaves an uneven mix of sizes. When a size is gone, it&apos;s usually gone for good.</p>
      <h2 id="shipping" className="scroll-mt-24 border-t border-hairline pt-6 font-display text-xl">Shipping</h2>
      <p>Flat {formatPeso(SHIPPING_FEE_CENTAVOS)} anywhere in the Philippines. Orders ship within 2 business days after payment.</p>
    </article>
  )
}
