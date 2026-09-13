import React, { useRef, useState } from 'react'
import { ImagePlus, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { prepareImage, aspectWarning, uploadToStorage } from '../utils/prepareImage'

/**
 * Picks an image, normalises it to JPEG in the browser, uploads it straight to
 * R2 through a presigned URL, and reports back the public URL that Instagram
 * will fetch.
 */
export default function ImagePicker({ onUploaded, notify }) {
  const { t } = useLanguage()
  const m = t.create.media

  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [dims, setDims] = useState(null)
  const [warning, setWarning] = useState(null)
  const [state, setState] = useState('idle') // idle | working | done
  const [dragging, setDragging] = useState(false)

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setDims(null)
    setWarning(null)
    setState('idle')
    onUploaded(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = async (file) => {
    if (!file) return
    setState('working')
    setWarning(null)

    try {
      const { blob, width, height, previewUrl } = await prepareImage(file)

      if (preview) URL.revokeObjectURL(preview)
      setPreview(previewUrl)
      setDims({ width, height })

      const aspect = aspectWarning(width, height)
      if (aspect) setWarning(m[aspect === 'too-tall' ? 'tooTall' : 'tooWide'])

      const publicUrl = await uploadToStorage(blob)
      onUploaded(publicUrl)
      setState('done')
    } catch (error) {
      // 'failed', not 'idle': the preview is already on screen, and the idle
      // branch renders it with a green tick reading "uploaded" — announcing
      // success for a file that never arrived.
      setState('failed')
      onUploaded(null)

      const message =
        error.code === 'storage-blocked'
          ? m.uploadBlocked
              .replace('{origin}', error.origin)
              .replace('{reason}', error.cause?.message ?? '')
          : error.message === 'not-an-image'
            ? m.notAnImage
            : m.uploadFailed

      setWarning(message)
      notify(message, 'warn')
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  return (
    <div>
      <span className="label">{m.label}</span>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {preview ? (
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white/70">
          <div className="relative">
            <img src={preview} alt="" className="max-h-56 w-full object-contain bg-slate-50" />
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
              {state === 'working' ? (
                <>
                  <Loader2 size={14} className="animate-spin text-slate-400" />
                  <span className="text-slate-500">{m.uploading}</span>
                </>
              ) : state === 'failed' ? (
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
              {dims && (
                <span className="ml-1 font-semibold text-slate-400">
                  {dims.width}×{dims.height}
                </span>
              )}
            </span>

            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs font-bold text-brand-600 hover:underline"
            >
              {m.change}
            </button>
          </div>

          {warning && (
            <p
              className={`flex items-start gap-1.5 border-t px-3 py-2 text-xs font-semibold ${
                state === 'failed'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <AlertTriangle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
              {warning}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={state === 'working'}
          className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 transition-all ${
            dragging
              ? 'border-brand-500 bg-brand-50'
              : 'border-slate-200 bg-white/60 hover:border-brand-400 hover:bg-white'
          }`}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            {state === 'working' ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ImagePlus size={20} strokeWidth={2.5} />
            )}
          </span>
          <span className="text-sm font-bold text-slate-600">
            {state === 'working' ? m.uploading : m.pick}
          </span>
          <span className="text-xs font-semibold text-slate-400">{m.hint}</span>
        </button>
      )}
    </div>
  )
}
