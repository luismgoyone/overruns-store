'use client'

import { sizeLabel } from '@/lib/catalog/constants'
import type { Variant } from '@/lib/catalog/types'

export function SizePicker({ variants, selected, onSelect }: { variants: Variant[]; selected: string | null; onSelect: (variantId: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide">Size</legend>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const soldOut = v.stock <= 0
          const isSelected = selected === v.id
          return (
            <button
              key={v.id}
              type="button"
              disabled={soldOut}
              aria-pressed={isSelected}
              aria-label={soldOut ? `${sizeLabel(v.size)} (sold out)` : undefined}
              onClick={() => onSelect(v.id)}
              className={`h-11 min-w-12 border px-3 text-sm font-semibold ${
                soldOut ? 'cursor-not-allowed border-muted/50 bg-paper text-muted' : isSelected ? 'border-ink bg-ink text-paper' : 'border-ink bg-card hover:bg-paper'
              }`}
            >
              {soldOut ? <s>{sizeLabel(v.size)}</s> : sizeLabel(v.size)}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
