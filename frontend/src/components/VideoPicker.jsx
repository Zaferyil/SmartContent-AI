import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Film, Loader2, X } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { REEL, formatDuration, formatSize, prepareVideo } from '../utils/prepareVideo'
import { uploadToStorage } from '../utils/storage'

const fill = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? '').toString())

/**
 * Picks one video, checks it against Instagram's Reel specification in the
 * browser, uploads it straight to R2 and reports the public URL Instagram will
 * fetch.
 *
 * Deliberately not the image picker with a different `accept`: video is not
 * converted, the checks are different ones, and the upload is long enough that
 * a percentage is the difference between waiting and wondering.
 */
export default function VideoPicker({ onUploaded, notify }) {
  const { t, language } = useLanguage()
  const m = t.create.video

  const inputRef = useRef(null)
  const [item, setItem] = useState(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  // A picked video holds an object URL for its preview; losing it on unmount
  // leaks the whole file until the tab closes.
  useEffect(
    () => () => {
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    },
    [item?.previewUrl]
  )

  const reset = () => {
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    setItem(null)
    setProgress(0)
    setError(null)
    onUploaded(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = async (file) => {
    if (!file) return

    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    setItem(null)
    setError(null)
    setProgress(0)
    onUploaded(null)

    let video
    try {
      video = await prepareVideo(file)
    } catch (e) {
      const message = m.problems[e.code] ?? m.uploadFailed
      setError(message)
      notify(message, 'warn')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setItem({ ...video, size: file.size, state: 'uploading' })

    try {
      const url = await uploadToStorage(video.file, {
        contentType: video.contentType,
        onProgress: setProgress,
      })
      setItem((current) => (current ? { ...current, state: 'done' } : current))
      onUploaded(url)
    } catch (e) {
      const message =
        e.code === 'storage-blocked'
          ? t.create.media.uploadBlocked
              .replace('{origin}', e.origin)
              .replace('{host}', e.host ?? '?')
              .replace('{reason}', e.cause?.message ?? '')
          : e.code === 'server'
            ? e.message
            : m.uploadFailed

      setItem((current) => (current ? { ...current, state: 'failed' } : current))
      setError(message)
      notify(message, 'warn')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const openPicker = () => inputRef.current?.click()

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={REEL.accept}
      hidden
      onChange={(e) => handleFile(e.target.files?.[0])}
    />
  )

  const percent = Math.round(progress * 100)
  const uploading = item?.state === 'uploading'

  // Stated for every accepted video, not only a flawed one: the specification
  // is what the file will be judged against, and reading it after a rejection
  // is reading it too late.
  const note = error ?? (item?.warning ? m.problems[item.warning] : null)
  const tone = error ? 'error' : item?.warning ? 'warn' : null

  return (
    <div>
      <span className="label">{m.label}</span>
      {input}

      {!item ? (
        <button
          onClick={openPicker}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-4 py-7 transition-all hover:border-brand-400 hover:bg-white"
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <Film size={20} strokeWidth={2.5} />
          </span>
          <span className="text-sm font-bold text-slate-600">{m.pick}</span>
          <span className="text-center text-xs font-semibold text-slate-400">{m.hint}</span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white/70">
          <div className="relative">
            {/* Playable, because the one thing worth checking before publishing
                is that this is the right cut — and the picker is the last place
                it can be checked. */}
            <video
              src={item.previewUrl}
              controls
              playsInline
              className="max-h-64 w-full bg-slate-900 object-contain"
            />
            <button
              onClick={reset}
              aria-label={m.remove}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
            >
              <X size={16} strokeWidth={3} />
            </button>
          </div>

          {uploading && (
            <div className="h-1.5 w-full bg-slate-100">
              <div
                className="h-full bg-brand-500 transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-bold">
              {uploading ? (
                <>
                  <Loader2 size={14} className="animate-spin text-slate-400" />
                  {/* The percentage is real — it is how many bytes have left the
                      browser, not a timer pretending to be one. */}
                  <span className="text-slate-500">{fill(m.uploading, { percent })}</span>
                </>
              ) : item.state === 'failed' ? (
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

              <span className="font-semibold text-slate-400">
                {[
                  formatDuration(item.duration),
                  item.width ? `${item.width}×${item.height}` : null,
                  formatSize(item.size, language === 'de' ? 'de-DE' : 'en-US'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>

            <button
              onClick={openPicker}
              disabled={uploading}
              className="text-xs font-bold text-brand-600 hover:underline disabled:opacity-40"
            >
              {m.change}
            </button>
          </div>
        </div>
      )}

      {note && (
        <p
          className={`mt-2 flex items-start gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
            tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <AlertTriangle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
          <span className="break-words">{note}</span>
        </p>
      )}
    </div>
  )
}
