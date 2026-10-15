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
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((src, i) => (
          <li key={src} className="space-y-1">
            <div className="relative aspect-square border border-ink bg-card">
              <Image src={productImageUrl(src)} alt="" fill sizes="160px" className="object-cover" />
              {i === 0 ? <span className="absolute left-1 top-1 bg-tag px-1 text-[10px] font-bold uppercase">Cover</span> : null}
            </div>
            <div className="flex justify-between text-xs">
              {i > 0 ? <button type="button" className="underline" onClick={() => move(i)}>Make cover</button> : <span />}
              <button type="button" className="underline" onClick={() => remove(i)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      {images.length < MAX_IMAGES ? (
        <label className="inline-flex h-11 cursor-pointer items-center border border-ink bg-card px-4 text-sm font-semibold">
          {busy ? 'Uploading…' : 'Add photos'}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
        </label>
      ) : null}
      {error ? <p role="alert" className="text-sm font-semibold">{error}</p> : null}
    </div>
  )
}
