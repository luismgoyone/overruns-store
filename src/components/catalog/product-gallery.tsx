'use client'

import Image from 'next/image'
import { useState } from 'react'
import { productImageUrl } from '@/lib/catalog/images'

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0)
  if (images.length === 0) return <div className="aspect-square border-hairline bg-card sm:border" />
  return (
    <div className="relative">
      <div
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto border-hairline bg-card [scrollbar-width:none] sm:border"
      >
        {images.map((src, i) => (
          <div key={src} className="relative aspect-square w-full shrink-0 snap-center">
            <Image src={productImageUrl(src)} alt={`${name}, photo ${i + 1} of ${images.length}`} fill priority={i === 0} sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
          </div>
        ))}
      </div>
      {images.length > 1 ? (
        <div aria-hidden className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 bg-card/80 px-2 py-1.5">
          {images.map((src, i) => <span key={src} className={`h-1.5 w-4 ${i === index ? 'bg-ink' : 'bg-ink/25'}`} />)}
        </div>
      ) : null}
    </div>
  )
}
