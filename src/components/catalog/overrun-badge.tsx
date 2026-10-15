// Black stencil tag that marks every piece as an overrun.
export function OverrunBadge({ className = '', label = 'Overrun' }: { className?: string; label?: string }) {
  return (
    <span className={`inline-flex items-center bg-ink px-2 py-1 font-mono text-[11px] uppercase leading-none tracking-[0.15em] text-paper ${className}`}>
      {label}
    </span>
  )
}
