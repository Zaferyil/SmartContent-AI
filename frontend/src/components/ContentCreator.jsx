import React, { useState } from 'react'
import {
  Wand2,
  Copy,
  RefreshCw,
  Check,
  Bookmark,
  Loader2,
  Send,
  Image,
  Clock,
  Film,
  AlertTriangle,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { getPlatform } from '../data/platforms'
import { generateContent } from '../utils/generateContent'
import { publishPost } from '../utils/publishPost'
import ScreenHeader from './ScreenHeader'
import ImagePicker from './ImagePicker'

// Reels needs a video pipeline that a 10s synchronous function cannot run, so
// it is shown but not selectable until the background function exists.
const POST_TYPES = [
  { id: 'FEED', icon: Image, ready: true },
  { id: 'STORY', icon: Clock, ready: true },
  { id: 'REELS', icon: Film, ready: false },
]

const FORMATS = ['caption', 'hashtags', 'hook', 'cta', 'thread']
const TONES = ['friendly', 'professional', 'playful', 'bold']

const IDEA_KEYS = ['launch', 'tip', 'story', 'behind']

export default function ContentCreator({ selected, notify }) {
  const { t, language } = useLanguage()
  const [format, setFormat] = useState('caption')
  const [tone, setTone] = useState('friendly')
  const [topic, setTopic] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [imageUrl, setImageUrl] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [postType, setPostType] = useState('FEED')

  const run = async () => {
    if (!topic.trim()) return notify(t.create.needTopic, 'warn')
    if (selected.length === 0) return notify(t.create.needPlatform, 'warn')

    setBusy(true)
    // Simulated latency — replaced by the Netlify function call later.
    await new Promise((r) => setTimeout(r, 700))
    setResult(generateContent({ topic, format, tone: t.create.tones[tone], language }))
    setBusy(false)
    notify(t.create.generated)
  }

  const publish = async () => {
    if (!imageUrl) return notify(t.create.media.needImage, 'warn')

    setPublishing(true)
    setWaiting(false)
    try {
      await publishPost(
        { imageUrl, caption: result, postType },
        { onProgress: () => setWaiting(true) }
      )
      notify(t.create.media.published)
    } catch (error) {
      notify(`${t.create.media.publishFailed} ${error.message}`, 'warn')
    } finally {
      setPublishing(false)
      setWaiting(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      notify(t.create.copy, 'warn')
    }
  }

  return (
    <div>
      <ScreenHeader title={t.create.title} subtitle={t.create.subtitle} />

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        {/* ---------- Controls ---------- */}
        <div className="card space-y-5 p-5 sm:p-6 lg:col-span-2">
          <div>
            <span className="label">{t.create.postTypeLabel}</span>
            <div className="grid grid-cols-3 gap-2">
              {POST_TYPES.map(({ id, icon: Icon, ready }) => {
                const active = postType === id
                return (
                  <button
                    key={id}
                    onClick={() => (ready ? setPostType(id) : notify(t.create.reelsUnavailable, 'warn'))}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 py-3 text-[13px] font-bold transition-all ${
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : ready
                          ? 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
                          : 'border-dashed border-slate-200 bg-white/40 text-slate-300'
                    }`}
                  >
                    <Icon size={18} strokeWidth={2.5} />
                    {t.create.postTypes[id]}
                  </button>
                )
              })}
            </div>
            {postType === 'STORY' && (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-amber-700">
                <AlertTriangle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                {t.create.storyNoCaption}
              </p>
            )}
          </div>

          <div>
            <span className="label">{t.create.formatLabel}</span>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((key) => {
                const active = format === key
                return (
                  <button
                    key={key}
                    onClick={() => setFormat(key)}
                    className={`rounded-xl px-3 py-2 text-[13px] font-bold transition-all ${
                      active
                        ? 'text-white shadow-md shadow-brand-500/25'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    style={active ? { backgroundImage: 'var(--grad-brand)' } : undefined}
                  >
                    {t.create.formats[key]}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="label">{t.create.toneLabel}</span>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map((key) => {
                const active = tone === key
                return (
                  <button
                    key={key}
                    onClick={() => setTone(key)}
                    className={`rounded-xl border-2 px-3 py-2.5 text-[13px] font-bold transition-all ${
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {t.create.tones[key]}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="topic">
              {t.create.topicLabel}
            </label>
            <textarea
              id="topic"
              rows={4}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t.create.topicPlaceholder}
              className="field resize-y"
            />
          </div>

          <ImagePicker onUploaded={setImageUrl} notify={notify} />

          <div>
            <span className="label">{t.create.targetLabel}</span>
            {selected.length === 0 ? (
              <p className="text-sm text-slate-400">{t.platforms.noneSelected}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selected.map((id) => {
                  const p = getPlatform(id)
                  if (!p) return null
                  return (
                    <span
                      key={id}
                      className={`chip bg-gradient-to-br text-white shadow-sm ${p.gradient}`}
                    >
                      <span className="text-sm leading-none">{p.icon}</span>
                      {p.name}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          <button onClick={run} disabled={busy} className="btn-primary w-full">
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" strokeWidth={2.5} />
                {t.create.generating}
              </>
            ) : (
              <>
                <Wand2 size={18} strokeWidth={2.5} />
                {t.create.generate}
              </>
            )}
          </button>

          <div>
            <span className="label">{t.create.ideasTitle}</span>
            <div className="flex flex-wrap gap-2">
              {IDEA_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setTopic(t.create.ideas[key])}
                  className="rounded-xl border-2 border-dashed border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600"
                >
                  {t.create.ideas[key]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- Result ---------- */}
        <div className="card flex flex-col p-5 sm:p-6 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-700">{t.create.resultLabel}</h3>
            {result && (
              <span className="text-xs font-semibold text-slate-400">
                {result.length} {t.create.characters}
              </span>
            )}
          </div>

          <div className="min-h-[260px] flex-1 rounded-2xl border-2 border-slate-100 bg-white/60 p-4 sm:min-h-[320px]">
            {result ? (
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">
                {result}
              </p>
            ) : (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 text-center">
                <span
                  className="grid h-14 w-14 place-items-center rounded-2xl text-white opacity-90"
                  style={{ backgroundImage: 'var(--grad-brand)' }}
                >
                  <Wand2 size={24} strokeWidth={2.5} />
                </span>
                <p className="max-w-xs text-sm text-slate-400">{t.create.emptyResult}</p>
              </div>
            )}
          </div>

          {result && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button onClick={copy} className="btn-ghost !py-3">
                {copied ? <Check size={17} strokeWidth={3} /> : <Copy size={17} strokeWidth={2.5} />}
                {copied ? t.create.copied : t.create.copy}
              </button>
              <button onClick={run} disabled={busy} className="btn-ghost !py-3">
                <RefreshCw size={17} strokeWidth={2.5} className={busy ? 'animate-spin' : ''} />
                {t.create.regenerate}
              </button>
              <button onClick={() => notify(t.create.saved)} className="btn-ghost !py-3">
                <Bookmark size={17} strokeWidth={2.5} />
                {t.create.save}
              </button>
            </div>
          )}

          {result && (
            <button
              onClick={publish}
              disabled={publishing || !imageUrl}
              title={!imageUrl ? t.create.media.needImage : undefined}
              className="btn-primary mt-2 w-full"
            >
              {publishing ? (
                <>
                  <Loader2 size={18} className="animate-spin" strokeWidth={2.5} />
                  {waiting ? t.create.media.processing : t.create.media.publishing}
                </>
              ) : (
                <>
                  <Send size={18} strokeWidth={2.5} />
                  {t.create.media.publish}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
