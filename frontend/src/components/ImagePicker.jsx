import React, { useRef, useState } from 'react'
import { ImagePlus, X, Loader2, CheckCircle2, AlertTriangle, Plus } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { prepareImage, aspectWarning, uploadToStorage } from '../utils/prepareImage'

const fill = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? '').toString())

let seq = 0
const nextKey = () => `img-${(seq += 1)}`

/**
 * Picks images, normalises each to JPEG in the browser, uploads them straight
 * to R2 through presigned URLs, and reports back the public URLs Instagram
 * will fetch.
 *
 * `max` decides the shape: one image is a single large preview, several is a
 * strip in swipe order. Both go through the same convert-and-upload path, so
 * there is one place where an upload can fail and one message when it does.
 *
 * onUploaded is always called with an array, even for max 1 — a caller that
 * wants the single url takes [0]. Two output shapes from one component is the
 * kind of thing that reads fine and breaks quietly.
 */
export default function ImagePicker({ onUploaded, notify, max = 1 }) {
  const { t } = useLanguage()
  const m = t.create.media

  const inputRef = useRef(null)
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [warning, setWarning] = useState(null)

  const many = max > 1
  const done = items.filter((item) => item.state === 'done')
  const room = max - items.length

  const report = (list) => onUploaded(list.filter((i) => i.state === 'done').map((i) => i.url))

  const reset = () => {
    items.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl))
    setItems([])
    setWarning(null)
    onUploaded([])
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeAt = (key) =>
    setItems((current) => {
      const gone = current.find((i) => i.key === key)
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl)
      const next = current.filter((i) => i.key !== key)
      report(next)
      return next
    })

  const handleFiles = async (files) => {
    // A single-image picker replaces; a carousel appends. Without this the
    // "change" button finds no room left and quietly does nothing.
    const replacing = !many
    const picked = [...files].slice(0, replacing ? 1 : Math.max(0, room))
    if (picked.length === 0) return

    if (replacing) {
      items.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl))
      setItems([])
      onUploaded([])
    }

    setBusy(true)
    setWarning(null)

    // Sequential, not all at once: the progress count is then honest, and a
    // failure names the file it belongs to instead of one of several at random.
    for (const file of picked) {
      const key = nextKey()
      try {
        const { blob, width, height, previewUrl } = await prepareImage(file)
        setItems((current) => [...current, { key, previewUrl, width, height, state: 'working' }])

        const url = await uploadToStorage(blob)
        setItems((current) => {
          const next = current.map((i) => (i.key === key ? { ...i, url, state: 'done' } : i))
          report(next)
          return next
        })
      } catch (error) {
        const message =
          error.code === 'storage-blocked'
            ? m.uploadBlocked
                .replace('{origin}', error.origin)
                .replace('{host}', error.host ?? '?')
                .replace('{reason}', error.cause?.message ?? '')
            : error.message === 'not-an-image'
              ? m.notAnImage
              : error.code === 'server'
                ? error.message
                : m.uploadFailed

        setItems((current) => {
          const next = current.some((i) => i.key === key)
            ? current.map((i) => (i.key === key ? { ...i, state: 'failed' } : i))
            : [...current, { key, state: 'failed' }]
          report(next)
          return next
        })
        setWarning(message)
        notify(message, 'warn')
      }
    }

    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  // Instagram crops every image in a carousel to the ratio of the first one,
  // so that is the only one worth warning about — and the warning has to say
  // what happens to the rest.
  const first = items.find((i) => i.width)
  const aspect = first ? aspectWarning(first.width, first.height) : null
  const aspectNote = aspect ? m[aspect === 'too-tall' ? 'tooTall' : 'tooWide'] : null

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files ?? [])
  }

  const openPicker = () => inputRef.current?.click()

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple={many}
      hidden
      onChange={(e) => handleFiles(e.target.files ?? [])}
    />
  )

  const emptyTile = (
    <button
      onClick={openPicker}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      disabled={busy}
      className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 transition-all ${
        dragging
          ? 'border-brand-500 bg-brand-50'
          : 'border-slate-200 bg-white/60 hover:border-brand-400 hover:bg-white'
      }`}
    >
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        {busy ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} strokeWidth={2.5} />}
      </span>
      <span className="text-sm font-bold text-slate-600">{busy ? m.uploading : many ? m.pickMany : m.pick}</span>
      <span className="text-xs font-semibold text-slate-400">
        {many ? fill(m.hintMany, { max }) : m.hint}
      </span>
    </button>
  )

  // The cropping note is not conditional on anything: Instagram crops every
  // carousel to the first image's ratio whether or not that ratio is a problem,
  // and finding that out after publishing is too late to reorder them.
  const cropNote = many && items.length > 0 ? m.carouselCrop : null
  const notice = (warning || aspectNote || cropNote) && (
    <p
      className={`mt-2 flex items-start gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
        warning
          ? 'border-rose-200 bg-rose-50 text-rose-900'
          : aspectNote
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-slate-200 bg-slate-50 text-slate-500'
      }`}
    >
      <AlertTriangle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
      <span className="break-words">
        {warning ?? (
          <>
            {aspectNote}
            {aspectNote && cropNote ? ' ' : ''}
            {cropNote}
          </>
        )}
      </span>
    </p>
  )

  return (
    <div>
      <span className="label">{many ? m.labelMany : m.label}</span>
      {input}

      {items.length === 0 ? (
        emptyTile
      ) : many ? (
        <div className="rounded-2xl border-2 border-slate-200 bg-white/70 p-2.5">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item, index) => (
              <div
                key={item.key}
                className="group relative aspect-square overflow-hidden rounded-xl bg-slate-50"
              >
                {item.previewUrl && (
                  <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                )}

                {/* The number is the swipe order, which is the one thing about a
                    carousel that is not obvious from a grid of thumbnails. */}
                <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-md bg-black/60 text-[11px] font-extrabold text-white">
                  {index + 1}
                </span>

                {item.state === 'working' && (
                  <span className="absolute inset-0 grid place-items-center bg-white/70">
                    <Loader2 size={16} className="animate-spin text-slate-500" />
                  </span>
                )}
                {item.state === 'failed' && (
                  <span className="absolute inset-0 grid place-items-center bg-rose-50/85">
                    <AlertTriangle size={16} className="text-rose-600" strokeWidth={2.5} />
                  </span>
                )}

                <button
                  onClick={() => removeAt(item.key)}
                  aria-label={m.remove}
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-md bg-black/60 text-white transition-colors hover:bg-black/80"
                >
                  <X size={11} strokeWidth={3} />
                </button>
              </div>
            ))}

            {room > 0 && (
              <button
                onClick={openPicker}
                disabled={busy}
                aria-label={m.addMore}
                className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-slate-200 text-slate-300 transition-colors hover:border-brand-400 hover:text-brand-500 disabled:opacity-50"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={3} />}
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="flex items-center gap-1.5 text-xs font-bold">
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin text-slate-400" />
                  <span className="text-slate-500">{m.uploading}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="text-emerald-600" strokeWidth={2.5} />
                  <span className="text-emerald-700">{fill(m.readyCount, { n: done.length })}</span>
                </>
              )}
            </span>
            <button onClick={reset} className="text-xs font-bold text-slate-400 hover:text-rose-600">
              {m.removeAll}
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white/70">
          <div className="relative">
            <img
              src={items[0].previewUrl}
              alt=""
              className="max-h-56 w-full bg-slate-50 object-contain"
            />
            <button
              onClick={reset}
              aria-label={m.remove}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
            >
              <X size={16} strokeWidth={3} />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-bold">
              {items[0].state === 'working' ? (
                <>
                  <Loader2 size={14} className="animate-spin text-slate-400" />
                  <span className="text-slate-500">{m.uploading}</span>
                </>
              ) : items[0].state === 'failed' ? (
                <>
                  <AlertTriangle size={14} className="text-rose-600" strokeWidth={2.5} />
                  <span className="text-rose-700">{m.uploadFailedShort}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="text-emerald-600" strokeWidth={2.5} />
                  <span className="text-emerald-700">{m.ready}</span>
                </>
              )}
              {items[0].width && (
                <span className="ml-1 font-semibold text-slate-400">
                  {items[0].width}×{items[0].height}
                </span>
              )}
            </span>

            <button onClick={openPicker} className="text-xs font-bold text-brand-600 hover:underline">
              {m.change}
            </button>
          </div>
        </div>
      )}

      {notice}
    </div>
  )
}
