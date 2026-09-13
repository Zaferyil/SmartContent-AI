import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  CalendarClock,
  Copy,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { getPlatform, PLATFORMS } from '../../data/platforms'
import { fromDateTimeInput, toDateInput, toTimeInput } from '../../utils/calendar'
import { generateCaption } from '../../utils/generateCaption'
import ImagePicker from '../ImagePicker'
import StatusChip from './StatusChip'

const POST_TYPES = ['FEED', 'STORY']

const hashtagsIn = (caption) => (caption ?? '').match(/#[\p{L}\p{N}_]+/gu) ?? []

/**
 * The detail panel for one calendar entry.
 *
 * It is also where a post is created, so the calendar does not depend on the
 * Create screen to have anything to show. The pieces it needs already exist —
 * the same uploader and the same caption job the Create screen uses — so this
 * adds a surface, not a second way of doing the work.
 */
export default function PostDrawer({
  item,
  channels,
  publishable,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  onPublishNow,
  notify,
}) {
  const { t, language } = useLanguage()
  const d = t.schedule.drawer

  const [platform, setPlatform] = useState('instagram')
  const [postType, setPostType] = useState('FEED')
  const [imageUrl, setImageUrl] = useState(null)
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [writing, setWriting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (!item) return
    const when = item.scheduledFor ? new Date(item.scheduledFor) : new Date()
    setPlatform(item.platform ?? 'instagram')
    setPostType(item.postType ?? 'FEED')
    setImageUrl(item.imageUrl ?? null)
    setCaption(item.caption ?? '')
    setDate(toDateInput(when))
    setTime(toTimeInput(when))
    setReplacing(false)
  }, [item])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)

    // The page behind must not scroll under an overlay that covers it.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const tags = useMemo(() => hashtagsIn(caption), [caption])

  if (!item) return null

  const isNew = !item.id
  const canPublish = publishable.includes(platform)
  const live = item.status === 'published'

  const collect = (status) => ({
    ...item,
    platform,
    postType,
    imageUrl,
    caption,
    scheduledFor: fromDateTimeInput(date, time).toISOString(),
    status,
  })

  const write = async () => {
    if (!imageUrl) return notify(d.needImage, 'warn')
    setWriting(true)
    try {
      setCaption(await generateCaption({ imageUrl, language, postType }))
    } catch (error) {
      notify(error.message, 'warn')
    } finally {
      setWriting(false)
    }
  }

  const save = async (status) => {
    if (!date || !time) return notify(d.needTime, 'warn')
    if (status === 'scheduled' && !imageUrl) return notify(d.needImage, 'warn')

    setSaving(true)
    try {
      await onSave(collect(status))
    } catch (error) {
      notify(error.message, 'warn')
    } finally {
      setSaving(false)
    }
  }

  const publishNow = async () => {
    if (!imageUrl) return notify(d.needImage, 'warn')
    setPublishing(true)
    try {
      await onPublishNow(collect(item.status))
    } catch (error) {
      notify(error.message, 'warn')
    } finally {
      setPublishing(false)
    }
  }

  const field = 'field'

  // Through a portal, because the screen wrapper keeps a transform from its
  // entry animation and a transformed ancestor becomes the containing block
  // for `position: fixed` — which would trap this panel inside the page.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        aria-label={t.common.close}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-sm"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? d.newTitle : d.editTitle}
        className="relative flex h-full w-full flex-col bg-canvas shadow-2xl sm:max-w-md"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/70 px-4 py-3.5 backdrop-blur">
          <h2 className="text-base font-extrabold tracking-tight">
            {isNew ? d.newTitle : d.editTitle}
          </h2>
          <div className="flex items-center gap-2">
            <StatusChip status={item.status} />
            <button
              onClick={onClose}
              aria-label={t.common.close}
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
          {item.status === 'failed' && (
            <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-3.5">
              <p className="flex items-center gap-2 text-sm font-extrabold text-rose-800">
                <AlertCircle size={16} strokeWidth={2.5} />
                {d.failedTitle}
              </p>
              {item.error && (
                <p className="mt-1 break-words text-[13px] font-semibold text-rose-900/70">
                  {item.error}
                </p>
              )}
            </div>
          )}

          {!canPublish && (
            <p className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/60 p-3.5 text-[13px] font-semibold text-amber-900">
              {d.notPublishable}
            </p>
          )}

          {/* ---------- Channel ---------- */}
          <div>
            <span className="label">{d.platform}</span>
            <div className="flex flex-wrap gap-1.5">
              {(channels.length ? channels : ['instagram']).map((id) => {
                const p = getPlatform(id) ?? PLATFORMS.find((x) => x.id === id)
                if (!p) return null
                const active = platform === id
                return (
                  <button
                    key={id}
                    onClick={() => setPlatform(id)}
                    disabled={live}
                    className={`chip border-2 transition-all ${
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white/70 text-slate-500'
                    }`}
                  >
                    <span className="text-sm leading-none">{p.icon}</span>
                    {p.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ---------- When ---------- */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="post-date">
                {d.date}
              </label>
              <input
                id="post-date"
                type="date"
                value={date}
                disabled={live}
                onChange={(e) => setDate(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className="label" htmlFor="post-time">
                {d.time}
              </label>
              <input
                id="post-time"
                type="time"
                value={time}
                disabled={live}
                onChange={(e) => setTime(e.target.value)}
                className={field}
              />
            </div>
          </div>

          {/* ---------- Post type ---------- */}
          <div>
            <span className="label">{t.create.postTypeLabel}</span>
            <div className="flex gap-1.5">
              {POST_TYPES.map((id) => (
                <button
                  key={id}
                  onClick={() => setPostType(id)}
                  disabled={live}
                  className={`chip border-2 transition-all ${
                    postType === id
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white/70 text-slate-500'
                  }`}
                >
                  {t.create.postTypes[id]}
                </button>
              ))}
            </div>
          </div>

          {/* ---------- Media ---------- */}
          {/* An entry that already has an image shows it. The uploader only
              previews a file picked in this session, so without this an edit
              would look as though the image had been lost. */}
          {imageUrl && !replacing ? (
            <div>
              <span className="label">{live ? d.preview : d.media}</span>
              <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white/70">
                <img
                  src={imageUrl}
                  alt=""
                  className="max-h-56 w-full bg-slate-50 object-contain"
                />
                {!live && (
                  <div className="px-3 py-2 text-right">
                    <button
                      onClick={() => setReplacing(true)}
                      className="text-xs font-bold text-brand-600 hover:underline"
                    >
                      {t.create.media.change}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : live ? (
            <p className="text-xs font-semibold text-slate-400">{d.needImage}</p>
          ) : (
            <ImagePicker
              key={item.id ?? 'new'}
              onUploaded={(url) => url && setImageUrl(url)}
              notify={notify}
            />
          )}

          {/* ---------- Caption ---------- */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="label !mb-0">{d.caption}</span>
              {!live && (
                <button
                  onClick={write}
                  disabled={writing}
                  className="flex items-center gap-1 text-xs font-extrabold text-brand-600 transition-colors hover:text-brand-700 disabled:text-slate-300"
                >
                  {writing ? (
                    <Loader2 size={13} className="animate-spin" strokeWidth={2.5} />
                  ) : (
                    <Sparkles size={13} strokeWidth={2.5} />
                  )}
                  {writing ? d.writing : d.writeWithAi}
                </button>
              )}
            </div>
            <textarea
              rows={7}
              value={caption}
              disabled={live}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={d.captionPlaceholder}
              className="field resize-y"
            />
          </div>

          {/* ---------- Hashtags ---------- */}
          <div>
            <span className="label">{d.hashtags}</span>
            {tags.length === 0 ? (
              <p className="text-xs font-semibold text-slate-400">{d.noHashtags}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => (
                  <span key={`${tag}-${i}`} className="chip bg-slate-100 text-slate-500">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------- Actions ---------- */}
        <footer className="space-y-2 border-t border-slate-200/70 bg-white/70 px-4 py-3.5 backdrop-blur">
          {!live && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => save('draft')} disabled={saving} className="btn-ghost !py-3">
                {saving ? (
                  <Loader2 size={16} className="animate-spin" strokeWidth={2.5} />
                ) : (
                  <CalendarClock size={16} strokeWidth={2.5} />
                )}
                {d.keepDraft}
              </button>
              <button
                onClick={() => save('scheduled')}
                disabled={saving || !canPublish}
                title={canPublish ? undefined : d.notPublishable}
                className="btn-primary !py-3"
              >
                <CalendarClock size={16} strokeWidth={2.5} />
                {item.status === 'failed' ? t.schedule.actions.retry : d.schedule}
              </button>
            </div>
          )}

          {!live && !isNew && canPublish && (
            <button onClick={publishNow} disabled={publishing} className="btn-ghost w-full !py-3">
              {publishing ? (
                <Loader2 size={16} className="animate-spin" strokeWidth={2.5} />
              ) : (
                <Send size={16} strokeWidth={2.5} />
              )}
              {t.schedule.actions.publishNow}
            </button>
          )}

          {!isNew && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onDuplicate(item)} className="btn-ghost !py-2.5 !text-[13px]">
                <Copy size={15} strokeWidth={2.5} />
                {t.schedule.actions.duplicate}
              </button>
              <button
                onClick={() => onDelete(item)}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-rose-50 py-2.5 text-[13px] font-bold text-rose-600 transition-colors hover:bg-rose-100"
              >
                <Trash2 size={15} strokeWidth={2.5} />
                {t.schedule.actions.delete}
              </button>
            </div>
          )}
        </footer>
      </aside>
    </div>,
    document.body
  )
}
