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
  Album,
  Clock,
  Film,
  AlertTriangle,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { getPlatform } from '../data/platforms'
import { generateCaption } from '../utils/generateCaption'
import { publishPost } from '../utils/publishPost'
import { fanOut, outcome } from '../utils/fanOut'
import { fetchSchedule, saveScheduled } from '../utils/schedule'
import { atTime, addDays } from '../utils/calendar'
import ScreenHeader from './ScreenHeader'
import ImagePicker from './ImagePicker'
import VideoPicker from './VideoPicker'
import ChannelResults from './ChannelResults'

const POST_TYPES = [
  { id: 'FEED', icon: Image },
  { id: 'CAROUSEL', icon: Album },
  { id: 'STORY', icon: Clock },
  { id: 'REELS', icon: Film },
]

// Meta's ceiling for a carousel.
const MAX_CAROUSEL = 10

const FORMATS = ['caption', 'hashtags', 'hook', 'cta', 'thread']
const TONES = ['friendly', 'professional', 'playful', 'bold']

const IDEA_KEYS = ['launch', 'tip', 'story', 'behind']

const fill = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? '').toString())

export default function ContentCreator({ selected, accounts = [], notify, onGoToSchedule }) {
  const { t, language } = useLanguage()
  const [format, setFormat] = useState('caption')
  const [tone, setTone] = useState('friendly')
  const [topic, setTopic] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  // Always a list, whatever the post type — the picker reports one shape and
  // the carousel is the only type that reads past the first entry.
  const [imageUrls, setImageUrls] = useState([])
  // A reel's video, once it is in storage. Kept apart from imageUrls rather than
  // squeezed in beside them: they go to different Graph parameters, and a video
  // sitting in an image field is a post that fails at the last step.
  const [videoUrl, setVideoUrl] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [postType, setPostType] = useState('FEED')
  const [accountIds, setAccountIds] = useState([])
  const [results, setResults] = useState(null)
  const [savingDraft, setSavingDraft] = useState(false)
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

  // Switching the post type swaps the picker out, and a picker that is not on
  // screen cannot show what it holds. Without this the uploads from the previous
  // type stay in state behind an empty picker — a publish button offering to
  // send an image that is nowhere in sight.
  useEffect(() => {
    setImageUrls([])
    setVideoUrl(null)
    setResults(null)
  }, [postType])

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
  const isCarousel = postType === 'CAROUSEL'
  // A reel is the short way round on purpose: upload the video, write the
  // caption by hand, publish. No caption is generated from it — the copy that
  // makes a reel work is written against the cut, and this screen has never
  // seen the cut. Nothing is kept either: the calendar has no field for a video,
  // so a "draft" reel would be a draft with the video missing from it.
  const isReel = postType === 'REELS'
  const imageUrl = imageUrls[0] ?? null

  // A carousel of one is a feed post, so Instagram refuses it. Catching it here
  // keeps the button from offering work that cannot succeed.
  const enoughImages = isCarousel ? imageUrls.length >= 2 : Boolean(imageUrl)
  const hasMedia = isReel ? Boolean(videoUrl) : enoughImages
  // The caption is optional on a reel — Instagram publishes one without it, and
  // demanding text the user did not want is the app inventing a rule.
  const canPublish = hasMedia && (isStory || isReel || Boolean(result))

  const run = async () => {
    // The copy is written from the image, so there is nothing to write without
    // one. For a carousel that is the first image — the one people see before
    // they decide whether to swipe.
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
    if (!hasMedia) {
      return notify(
        isReel
          ? t.create.video.needVideo
          : isCarousel
            ? t.create.media.needTwoImages
            : t.create.media.needImage,
        'warn'
      )
    }
    if (targets.length === 0) return notify(t.create.needPlatform, 'warn')

    setPublishing(true)
    setWaiting(false)
    setResults(null)
    try {
      const done = await fanOut(targets, (account) =>
        publishPost(
          {
            imageUrl,
            imageUrls,
            videoUrl,
            // Nothing for a story: Instagram ignores the field, and sending copy
            // it will not show would only make the record claim otherwise.
            caption: isStory ? '' : result,
            postType,
            accountId: account.id,
          },
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

  /**
   * Keeps the post for later, in the calendar, as a draft.
   *
   * This button used to fire the "saved to drafts" message and write nothing at
   * all — close the tab and the copy was gone. A draft is a real calendar entry
   * now, one per selected channel, the same shape publishing uses.
   */
  const saveDraft = async () => {
    if (!imageUrl && !result.trim()) return notify(t.create.nothingToSave, 'warn')
    if (targets.length === 0) return notify(t.create.needPlatform, 'warn')

    setSavingDraft(true)
    try {
      // A draft still needs a slot to sit in. Taken from the publishing settings
      // rather than picked here, so the calendar does not fill up with a time
      // the user never chose.
      const { settings } = await fetchSchedule()
      const when = atTime(addDays(new Date(), 1), settings?.preferredTimes?.[0] ?? '09:00')

      await saveScheduled(
        targets.map((account) => ({
          accountId: account.id,
          platform: account.platform,
          postType,
          imageUrl,
          imageUrls,
          caption: isStory ? '' : result,
          scheduledFor: when.toISOString(),
          status: 'draft',
        }))
      )

      notify(
        targets.length > 1 ? fill(t.create.savedMany, { n: targets.length }) : t.create.saved
      )
      onGoToSchedule?.()
    } catch (error) {
      notify(error.message, 'warn')
    } finally {
      setSavingDraft(false)
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
      {/* The standing subtitle promises copy written from an image, which is
          not what this screen does for a reel. */}
      <ScreenHeader
        title={t.create.title}
        subtitle={isReel ? t.create.video.subtitle : t.create.subtitle}
      />

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        {/* ---------- Controls ---------- */}
        <div className="card space-y-5 p-5 sm:p-6 lg:col-span-2">
          <div>
            <span className="label">{t.create.postTypeLabel}</span>
            {/* Four types now: two columns on a phone, one row from sm up. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {POST_TYPES.map(({ id, icon: Icon }) => {
                const active = postType === id
                return (
                  <button
                    key={id}
                    onClick={() => setPostType(id)}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 py-3 text-[13px] font-bold transition-all ${
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={18} strokeWidth={2.5} />
                    {t.create.postTypes[id]}
                  </button>
                )
              })}
            </div>
            {isStory && (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-amber-700">
                <AlertTriangle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                {t.create.storyNoCaption}
              </p>
            )}
            {isReel && (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-slate-500">
                <Film size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                {t.create.video.howItWorks}
              </p>
            )}
          </div>

          {isReel ? (
            <VideoPicker onUploaded={setVideoUrl} notify={notify} />
          ) : (
            /* Keyed on the post type: switching between one image and ten has to
               start the picker over, or the leftovers of the other mode linger. */
            <ImagePicker
              key={isCarousel ? 'many' : 'one'}
              max={isCarousel ? MAX_CAROUSEL : 1}
              onUploaded={setImageUrls}
              notify={notify}
            />
          )}

          {/*
            Format, tone and topic exist only to steer the caption writer, and a
            reel does not use it: the copy is typed by hand. Left on screen they
            would be three sets of controls that change nothing about the post —
            which reads as the app doing something it is not. The channel picker
            below them stays: a reel goes to a channel like anything else.
          */}
          {!isReel && (
          <>
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
          </>
          )}

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

          {!isReel && (
            <>
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
            </>
          )}
        </div>

        {/* ---------- Result ---------- */}
        <div className="card flex flex-col p-5 sm:p-6 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            {/* "Generated content" over a box nothing generated into is the
                app describing work it did not do. */}
            <h3 className="text-sm font-extrabold text-slate-700">
              {isReel ? t.create.video.captionLabel : t.create.resultLabel}
            </h3>
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
            there is nothing to type. A reel types into the same box, and this is
            the only way its caption can be written.
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
                placeholder={isReel ? t.create.video.captionPlaceholder : t.create.resultPlaceholder}
                aria-label={t.create.resultLabel}
                className="w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-60"
              />
            )}
          </div>

          {/*
            No draft button for a reel, and not because it was awkward: a
            scheduled post stores an image url and has no field for a video, so
            "save as draft" would keep the caption, drop the video, and leave a
            calendar entry that cannot publish. Saying so is the honest version
            of a button that appears to work.
          */}
          {isReel && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button onClick={copy} disabled={!result} className="btn-ghost !py-3 flex-1">
                {copied ? <Check size={17} strokeWidth={3} /> : <Copy size={17} strokeWidth={2.5} />}
                {copied ? t.create.copied : t.create.copy}
              </button>
              <p className="w-full text-xs font-semibold text-slate-400">
                {t.create.video.notSaved}
              </p>
            </div>
          )}

          {/* Shown as soon as there is anything worth keeping, not only once
              copy exists: an image with the caption still to come is a draft
              too, and a story never has copy at all. Copy and regenerate stay
              off until there is text for them to act on. */}
          {!isReel && (result || imageUrl) && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button onClick={copy} disabled={!result} className="btn-ghost !py-3">
                {copied ? <Check size={17} strokeWidth={3} /> : <Copy size={17} strokeWidth={2.5} />}
                {copied ? t.create.copied : t.create.copy}
              </button>
              <button onClick={run} disabled={busy || isStory || !result} className="btn-ghost !py-3">
                <RefreshCw size={17} strokeWidth={2.5} className={busy ? 'animate-spin' : ''} />
                {t.create.regenerate}
              </button>
              <button onClick={saveDraft} disabled={savingDraft} className="btn-ghost !py-3">
                {savingDraft ? (
                  <Loader2 size={17} className="animate-spin" strokeWidth={2.5} />
                ) : (
                  <Bookmark size={17} strokeWidth={2.5} />
                )}
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
                  {/* Instagram transcodes a reel after fetching it, which is
                      minutes rather than the moment an image takes. Saying
                      "processing the image" through that wait is both wrong and
                      the point at which someone closes the tab. */}
                  {waiting
                    ? isReel
                      ? t.create.video.processing
                      : t.create.media.processing
                    : t.create.media.publishing}
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
