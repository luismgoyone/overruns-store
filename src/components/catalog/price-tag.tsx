import { formatPeso } from '@/lib/money'

/** Whole-number discount off retail, or null when there's no (higher) retail price to compare against. */
export function percentOff(price: number, retail: number | null): number | null {
  if (!retail || retail <= price) return null
  const pct = Math.round((1 - price / retail) * 100)
  return pct > 0 ? pct : null
}

export function PriceTag({ price, retail, size = 'sm' }: { price: number; retail: number | null; size?: 'sm' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className={lg ? 'font-display text-3xl tracking-tight' : 'text-base font-bold'}>
        <span className="sr-only">Overrun price </span>{formatPeso(price)}
      </span>
      {retail ? (
        <s className={lg ? 'text-base text-muted' : 'text-sm text-muted'}>
          <span className="sr-only">Retail price </span>{formatPeso(retail)}
        </s>
      ) : null}
    </p>
  )
}
