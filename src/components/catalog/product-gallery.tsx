'use client'

import Image from 'next/image'
import { useState } from 'react'
import { productImageUrl } from '@/lib/catalog/images'

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0)
  if (images.length === 0) return <div className="aspect-square border border-ink bg-card" />
  return (
    <div>
      <div
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto border border-ink bg-card [scrollbar-width:none]"
      >
        {images.map((src, i) => (
          <div key={src} className="relative aspect-square w-full shrink-0 snap-center">
            <Image src={productImageUrl(src)} alt={`${name}, photo ${i + 1} of ${images.length}`} fill priority={i === 0} sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        ))}
      </div>
      {images.length > 1 ? (
        <div aria-hidden className="mt-3 flex justify-center gap-2">
          {images.map((src, i) => <span key={src} className={`h-2 w-2 rounded-full ${i === index ? 'bg-ink' : 'bg-muted/40'}`} />)}
        </div>
      ) : null}
    </div>
  )
}
