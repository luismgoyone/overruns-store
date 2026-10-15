import { formatPeso } from '@/lib/money'

export function PriceTag({ price, retail, size = 'sm' }: { price: number; retail: number | null; size?: 'sm' | 'lg' }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      {retail ? (
        <s className={size === 'lg' ? 'text-base text-muted' : 'text-sm text-muted'}>
          <span className="sr-only">Retail price </span>{formatPeso(retail)}
        </s>
      ) : null}
      <span className={size === 'lg' ? 'text-2xl font-bold' : 'text-base font-bold'}>
        <span className="sr-only">Overrun price </span>{formatPeso(price)}
      </span>
    </p>
  )
}
