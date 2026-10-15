'use client'

import Image from 'next/image'
import { useState } from 'react'
import { MAX_IMAGES } from '@/lib/admin/product-form'
import { downscaleImage } from '@/lib/admin/downscale-image'
import { PRODUCT_IMAGES_BUCKET, productImageUrl } from '@/lib/catalog/images'
import { createBrowserSupabase } from '@/lib/supabase/browser'

const MAX_SOURCE_BYTES = 20 * 1024 * 1024

export function ImageUploader({ initial }: { initial: string[] }) {
  const [images, setImages] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setBusy(true)
    const supabase = createBrowserSupabase()
    const added: string[] = []
    try {
      for (const file of Array.from(files).slice(0, MAX_IMAGES - images.length)) {
        if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)
        if (file.size > MAX_SOURCE_BYTES) throw new Error(`${file.name} is over 20 MB.`)
        const blob = await downscaleImage(file)
        const path = `products/${crypto.randomUUID()}.jpg`
        const { error: upErr } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
        added.push(path)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setImages((prev) => [...prev, ...added])
      setBusy(false)
    }
  }

  const move = (i: number) => setImages((prev) => [prev[i], ...prev.filter((_, j) => j !== i)])
  const remove = (i: number) => setImages((prev) => prev.filter((_, j) => j !== i))

  return (
    <div className="space-y-3">
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {images.map((src, i) => (
          <li key={src} className="border border-hairline bg-card p-1.5">
            <div className="relative aspect-square bg-paper">
              <Image src={productImageUrl(src)} alt={`Photo ${i + 1}`} fill sizes="200px" className="object-cover" />
              {i === 0 ? <span className="absolute left-0 top-0 bg-ink px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper">Cover</span> : null}
            </div>
            <div className="flex justify-between gap-2 pt-1.5 font-mono text-[11px] uppercase tracking-[0.1em]">
              {i > 0 ? <button type="button" className="min-h-8 underline-offset-4 hover:underline" onClick={() => move(i)}>Make cover</button> : <span />}
              <button type="button" className="min-h-8 font-bold text-tag-ink underline-offset-4 hover:underline" onClick={() => remove(i)}>Remove</button>
            </div>
          </li>
        ))}
        {images.length < MAX_IMAGES ? (
          <li>
            <label className={`flex aspect-square h-full min-h-32 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-hairline bg-paper p-3 text-center transition-colors hover:border-ink focus-within:border-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink ${busy ? 'cursor-wait opacity-60' : ''}`}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.15em]">{busy ? 'Uploading…' : 'Add photos'}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Up to {MAX_IMAGES} · resized on upload</span>
              <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
            </label>
          </li>
        ) : null}
      </ul>
      {error ? <p role="alert" className="border-l-4 border-tag pl-2 text-sm font-semibold">{error}</p> : null}
    </div>
  )
}
