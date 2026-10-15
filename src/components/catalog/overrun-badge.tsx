// Hang-tag shape: a pointed left edge with a punched hole.
export function OverrunBadge({ className = '', label = 'Overrun' }: { className?: string; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 bg-tag py-1 pl-4 pr-2 font-display text-[10px] text-ink [clip-path:polygon(10px_0,100%_0,100%_100%,10px_100%,0_50%)] ${className}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-paper" />
      {label}
    </span>
  )
}
