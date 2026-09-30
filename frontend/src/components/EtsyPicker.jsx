import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Heart, Loader2, ShoppingBag, X } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { fetchListings, formatPrice } from '../utils/etsy'

const fill = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? '').toString())

/**
 * Picks one live listing out of the shop.
 *
 * Read-only by construction: the server endpoint behind this can only ask Etsy
 * for listings that are already public, so nothing reachable from here can
 * change the shop. Choosing one hands its images and its own text back to the
 * Create screen; publishing is still a separate, deliberate press.
 */
export default function EtsyPicker({ open, onClose, onPick }) {
  const { t, language } = useLanguage()
  const e = t.create.etsy
  const locale = language === 'de' ? 'de-DE' : 'en-US'

  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    let live = true

    setData(null)
    setError(null)
    fetchListings()
      .then((result) => live && setData(result))
      .catch((err) => live && setError(err.message))

    return () => {
      live = false
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  const listings = data?.listings ?? []

  const body = error ? (
    <p className="flex items-start gap-2 rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
      <AlertTriangle size={16} strokeWidth={2.5} className="mt-px shrink-0" />
      <span className="break-words">{error}</span>
    </p>
  ) : !data ? (
    <div className="flex items-center justify-center gap-3 p-12 text-slate-400">
      <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
      <span className="font-semibold">{e.loading}</span>
    </div>
  ) : listings.length === 0 ? (
    <p className="p-10 text-center text-sm font-semibold text-slate-400">{e.empty}</p>
  ) : (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {listings.map((listing) => {
        const cover = listing.images[0]
        const price = formatPrice(listing.price, locale)
        return (
          <li key={listing.id}>
            <button
              onClick={() => onPick(listing)}
              disabled={listing.images.length === 0}
              className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white/70 text-left transition-all hover:border-brand-400 hover:shadow-md disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-none"
            >
              <div className="relative aspect-square w-full bg-slate-50">
                {cover ? (
                  <img
                    src={cover.thumbnail}
                    alt={cover.alt ?? ''}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-slate-300">
                    <ShoppingBag size={22} strokeWidth={2.5} />
                  </span>
                )}

                {/* The count is what tells a carousel from a single post before
                    it is chosen. */}
                {listing.images.length > 1 && (
                  <span className="absolute right-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                    {fill(e.photoCount, { n: listing.images.length })}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <span className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-700">
                  {listing.title}
                </span>
                <span className="mt-auto flex flex-wrap items-center gap-x-2 text-xs font-bold text-slate-500">
                  {price && <span>{price}</span>}
                  {listing.favorers > 0 && (
                    <span className="flex items-center gap-0.5 font-semibold text-slate-400">
                      <Heart size={11} strokeWidth={2.5} />
                      {listing.favorers}
                    </span>
                  )}
                </span>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )

  return createPortal(
    // Above the calendar drawer, which sits at z-[60]. At a lower layer this
    // opened behind it and its own backdrop swallowed every click.
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold tracking-tight">{e.title}</h2>
            {data?.shop && (
              <p className="truncate text-xs font-semibold text-slate-400">
                {fill(e.shopLine, { shop: data.shop.name, n: data.total ?? 0 })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={e.close}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{body}</div>

        {/* Stated once, where the choice is made: a listing shown here is
            already public on Etsy, and picking one only copies it into the
            editor. */}
        <p className="border-t border-slate-100 px-5 py-3 text-xs font-semibold text-slate-400">
          {data?.complete === false ? `${e.partial} ` : ''}
          {e.readOnly}
        </p>
      </div>
    </div>,
    document.body
  )
}
