import React, { useEffect, useRef, useState } from 'react'
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
import { generateCaption } from '../utils/generateCaption'
import { publishPost } from '../utils/publishPost'
import { fanOut, outcome } from '../utils/fanOut'
import ScreenHeader from './ScreenHeader'
import ImagePicker from './ImagePicker'
import ChannelResults from './ChannelResults'

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

const fill = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? '').toString())

export default function ContentCreator({ selected, accounts = [], notify }) {
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
  const [accountIds, setAccountIds] = useState([])
  const [results, setResults] = useState(null)
  const captionRef = useRef(null)

  // Default to the first connected account, and follow the list if it arrives
  // after this screen first rendered. Only the first, never all of them: the
  // button says "publish", and having it reach every channel by default is the
  // kind of surprise that cannot be taken back.
  useEffect(() => {
    setAccountIds((current) => {
      const kept = current.filter((id) => accounts.some((a) => a.id === id))
      if (kept.length) return kept
      return accounts[0] ? [accounts[0].id] : []
    })
  }, [accounts])

  const toggleAccount = (id) =>
    setAccountIds((current) =>
      current.includes(id)
        ? // Never down to nothing: an empty selection turns the publish button
          // into one that silently does nothing at all.
          current.length === 1
          ? current
          : current.filter((x) => x !== id)
        : [...current, id]
    )

  const targets = accounts.filter((a) => accountIds.includes(a.id))

  // Instagram drops the caption on a story, so writing one is work that gets
  // thrown away. The screen was still built around it: publishing only appeared
  // once copy existed, which left a story with an uploaded image and no way to
  // send it.
  const isStory = postType === 'STORY'
  const canPublish = Boolean(imageUrl) && (isStory || Boolean(result))

  const run = async () => {
    // The copy is written from the image, so there is nothing to write without one.
    if (!imageUrl) return notify(t.create.media.needImage, 'warn')
    if (selected.length === 0) return notify(t.create.needPlatform, 'warn')

    setBusy(true)
    setWaiting(false)
    try {
      const caption = await generateCaption(
        { imageUrl, language, postType, topic, tone, format },
        { onProgress: () => setWaiting(true) }
      )
      setResult(caption)
      notify(t.create.generated)
    } catch (error) {
      notify(error.message, 'warn')
    } finally {
      setBusy(false)
      setWaiting(false)
    }
  }

  const publish = async () => {
    if (!imageUrl) return notify(t.create.media.needImage, 'warn')
    if (targets.length === 0) return notify(t.create.needPlatform, 'warn')

    setPublishing(true)
    setWaiting(false)
    setResults(null)
    try {
      const done = await fanOut(targets, (account) =>
        publishPost(
          // Nothing for a story: Instagram ignores the field, and sending copy
          // it will not show would only make the record claim otherwise.
          { imageUrl, caption: isStory ? '' : result, postType, accountId: account.id },
          { onProgress: () => setWaiting(true) }
        )
      )

      // A single channel keeps the plain message it always had; the breakdown
      // would be a list of one, which reads as though something went wrong.
      if (done.length === 1) {
        const [only] = done
        if (only.ok) notify(t.create.media.published)
        else notify(`${t.create.media.publishFailed} ${only.error}`, 'warn')
      } else {
        setResults(done)
        const kind = outcome(done)
        const ok = done.filter((r) => r.ok).length
        if (kind === 'all') notify(fill(t.create.media.publishedAll, { n: ok }))
        else if (kind === 'none') notify(t.create.media.publishedNone, 'warn')
        else notify(fill(t.create.media.publishedSome, { ok, total: done.length }), 'warn')
      }
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

          <ImagePicker onUploaded={setImageUrl} notify={notify} />

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
            {/* Two rows, not four, and a line saying what this is not. At four
                rows it is the biggest empty box on the way down the screen, and
                the one place the caption panel is nowhere in sight on a narrow
                layout — so it reads as the place to write the post, and the
                copy typed here silently becomes a prompt instead. */}
            <textarea
              id="topic"
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t.create.topicPlaceholder}
              className="field resize-y"
            />
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {t.create.topicIsNotCaption}{' '}
              {/* The caption box is half a screen further down on a phone, and
                  saying where it is does not get anyone there. */}
              <button
                onClick={() => {
                  captionRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  captionRef.current?.focus({ preventScroll: true })
                }}
                className="font-extrabold text-brand-600 underline underline-offset-2 hover:text-brand-700"
              >
                {t.create.jumpToCaption}
              </button>
            </p>
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <span className="label !mb-0">{t.create.targetLabel}</span>
              {accounts.length > 1 && (
                <button
                  onClick={() =>
                    setAccountIds(
                      accountIds.length === accounts.length
                        ? [accounts[0].id]
                        : accounts.map((a) => a.id)
                    )
                  }
                  className="shrink-0 text-xs font-extrabold text-brand-600 transition-colors hover:text-brand-700"
                >
                  {accountIds.length === accounts.length
                    ? t.create.selectOne
                    : t.create.selectAll}
                </button>
              )}
            </div>

            {accounts.length === 0 ? (
              <p className="text-sm font-semibold text-amber-700">{t.schedule.noAccounts}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {accounts.map((account) => {
                    const p = getPlatform(account.platform)
                    const active = accountIds.includes(account.id)
                    return (
                      <button
                        key={account.id}
                        onClick={() => toggleAccount(account.id)}
                        aria-pressed={active}
                        className={`chip border-2 transition-all ${
                          active
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-slate-200 bg-white/70 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {active ? (
                          <Check size={13} strokeWidth={3} />
                        ) : (
                          p && <span className="text-sm leading-none">{p.icon}</span>
                        )}
                        @{account.username ?? account.externalId}
                      </button>
                    )
                  })}
                </div>

                {/* Posting to several channels at once is easy to do by accident
                    and impossible to undo, so the count is stated rather than
                    left to be read off the highlighted chips. */}
                {accountIds.length > 1 && (
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    {fill(t.create.targetCount, { n: accountIds.length })}
                  </p>
                )}
              </>
            )}
          </div>

          <button
            onClick={run}
            disabled={busy || isStory}
            title={isStory ? t.create.storyNoCaption : undefined}
            className="btn-primary w-full"
          >
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

          {/*
            Editable, not a read-only panel. The AI was the only way to fill
            this, so anyone who already knew what to write had to have something
            written for them first and could not correct a word of it. Typing
            here is now the other half of the same box: write your own, or press
            the button and edit what comes back.

            A story keeps the plain message — Instagram discards the caption, so
            there is nothing to type.
          */}
          <div className="flex min-h-[260px] flex-1 rounded-2xl border-2 border-slate-100 bg-white/60 p-4 sm:min-h-[320px]">
            {isStory ? (
              <div className="flex w-full flex-col items-center justify-center gap-3 text-center">
                <span
                  className="grid h-14 w-14 place-items-center rounded-2xl text-white opacity-90"
                  style={{ backgroundImage: 'var(--grad-brand)' }}
                >
                  <Wand2 size={24} strokeWidth={2.5} />
                </span>
                <p className="max-w-xs text-sm text-slate-400">{t.create.storyNothingToWrite}</p>
              </div>
            ) : (
              <textarea
                ref={captionRef}
                value={result}
                onChange={(e) => setResult(e.target.value)}
                disabled={busy}
                placeholder={t.create.resultPlaceholder}
                aria-label={t.create.resultLabel}
                className="w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-60"
              />
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

          {results && (
            <div className="mt-3">
              <ChannelResults results={results} title={t.create.media.perChannel} />
            </div>
          )}

          {canPublish && (
            <button
              onClick={publish}
              disabled={publishing}
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
                  {targets.length > 1
                    ? fill(t.create.media.publishToAll, { n: targets.length })
                    : t.create.media.publish}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
