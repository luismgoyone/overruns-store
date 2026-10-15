'use client'

import { sizeLabel } from '@/lib/catalog/constants'
import type { Variant } from '@/lib/catalog/types'

export function SizePicker({ variants, selected, onSelect }: { variants: Variant[]; selected: string | null; onSelect: (variantId: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-3 font-mono text-xs uppercase tracking-[0.15em]">Select size</legend>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2">
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
              className={`h-12 border px-2 font-mono text-sm uppercase transition-colors ${v.size === 'OS' ? 'col-span-2' : ''} ${
                soldOut ? 'cursor-not-allowed border-hairline bg-paper text-muted/60' : isSelected ? 'border-ink bg-ink text-paper' : 'border-muted bg-card hover:border-ink'
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
