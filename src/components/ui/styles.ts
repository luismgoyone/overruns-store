const buttonBase =
  'inline-flex h-12 items-center justify-center gap-2 border px-6 font-mono text-sm font-bold uppercase tracking-[0.15em] transition-colors disabled:cursor-not-allowed'

/** Orange call to action (add to cart, checkout, pay). Ink text keeps it readable on the orange. */
export const buttonPrimary = `${buttonBase} border-tag bg-tag text-ink hover:border-ink hover:bg-ink hover:text-paper disabled:border-hairline disabled:bg-hairline disabled:text-muted`
/** Solid black button for secondary-but-important actions. */
export const buttonInk = `${buttonBase} border-ink bg-ink text-paper hover:bg-card hover:text-ink disabled:border-hairline disabled:bg-hairline disabled:text-muted`
/** Outlined button. */
export const buttonSecondary = `${buttonBase} border-ink bg-card text-ink hover:bg-ink hover:text-paper`

const inputCore =
  'w-full border border-hairline text-base text-ink placeholder:text-muted/70 hover:border-muted focus:border-ink focus:bg-card focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-invalid:border-tag'
/** Text input inside a white panel (canvas-tinted field). */
export const inputBase = `${inputCore} h-12 bg-paper px-3`
/** Text input placed directly on the canvas background (white field). */
export const inputOnCanvas = `${inputCore} h-12 bg-card px-3`
/** Multi-line field inside a white panel. */
export const textareaBase = `${inputCore} bg-paper px-3 py-2`
/** Compact centered number field (stock per size). */
export const inputCompact = `${inputCore} h-11 bg-card px-1 text-center font-mono`

/** Small uppercase mono label (eyebrows, table headers, field labels). */
export const monoLabel = 'font-mono text-xs uppercase tracking-[0.15em]'
/** Orange eyebrow above a heading. */
export const eyebrow = `${monoLabel} text-tag-ink`
