import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { getPlatform } from '../data/platforms'
import { fetchPosts } from '../utils/posts'
import { deleteScheduled, fetchSchedule, saveScheduled, saveSettings } from '../utils/schedule'
import { publishPost } from '../utils/publishPost'
import { recommendedTimes } from '../utils/aiSchedule'
import {
  addDays,
  addMonths,
  atTime,
  isToday,
  moveToDay,
  sameDay,
  startOfWeek,
} from '../utils/calendar'
import ScreenHeader from './ScreenHeader'
import { DayView, MonthView, WeekView } from './calendar/CalendarViews'
import ListView from './calendar/ListView'
import PostDrawer from './calendar/PostDrawer'
import AiScheduleModal from './calendar/AiScheduleModal'
import PublishingSettings from './calendar/PublishingSettings'
import StatusChip from './calendar/StatusChip'

const VIEWS = ['day', 'week', 'month', 'list']

const fill = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? '').toString())

/** A post the publisher will still act on, soonest first. */
const upcoming = (items) =>
  items
    .filter((item) => ['draft', 'scheduled', 'publishing', 'failed'].includes(item.status))
    .filter((item) => item.scheduledFor)
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))

export default function ContentCalendar({ accounts = [], notify, onGoToCreate, onGoToSettings }) {
  const { t, language } = useLanguage()
  const c = t.schedule

  const [data, setData] = useState(null)
  const [posts, setPosts] = useState([])
  const [error, setError] = useState(null)

  const [view, setView] = useState('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [channel, setChannel] = useState('all')
  const [drawerItem, setDrawerItem] = useState(null)
  const [aiOpen, setAiOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const schedule = await fetchSchedule()
      setData(schedule)
      setError(null)
    } catch (e) {
      setError(e.message)
      setData({ items: [], settings: { preferredTimes: ['09:00'], postsPerDay: 3 }, publishable: [] })
    }
    // The report data feeds the AI recommendation. A failure here must not stop
    // the calendar rendering — it only costs the measured times.
    fetchPosts()
      .then(setPosts)
      .catch(() => setPosts([]))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const items = data?.items ?? []
  const settings = data?.settings
  const publishable = data?.publishable ?? []

  // The filter lists connected accounts, not platforms: a post belongs to an
  // account, and with two Instagram channels "Instagram" would not narrow
  // anything down.
  const defaultAccountId = accounts[0]?.id ?? null

  const visible = useMemo(() => {
    if (channel === 'all') return items
    return items.filter((item) => (item.accountId ?? defaultAccountId) === channel)
  }, [items, channel, defaultAccountId])

  const recommendation = useMemo(
    () => (settings ? recommendedTimes({ posts, settings }) : null),
    [posts, settings]
  )

  const queue = useMemo(() => upcoming(visible), [visible])
  const todayItems = useMemo(
    () => queue.filter((item) => sameDay(new Date(item.scheduledFor), new Date())),
    [queue]
  )
  const next = queue.find((item) => Date.parse(item.scheduledFor) > Date.now()) ?? null

  // ---------- mutations ----------

  const persist = async (fn, message) => {
    try {
      const updated = await fn()
      setData((prev) => ({ ...prev, items: updated }))
      if (message) notify(message)
      return updated
    } catch (e) {
      notify(e.message, 'warn')
      throw e
    }
  }

  // The drawer hands over a list, because one new post can cover several
  // channels and each channel is its own entry.
  const save = (entries) =>
    persist(
      async () => {
        await saveScheduled(entries)
        return (await fetchSchedule()).items
      },
      entries.length > 1 ? fill(c.toast.savedMany, { n: entries.length }) : c.toast.saved
    ).then(() => setDrawerItem(null))

  const remove = (item) =>
    persist(() => deleteScheduled([item.id]), c.toast.deleted).then(() => setDrawerItem(null))

  const duplicate = (item) =>
    persist(async () => {
      const { id, mediaId, error: _e, containerId, ...rest } = item
      await saveScheduled([
        {
          ...rest,
          status: 'draft',
          scheduledFor: addDays(new Date(item.scheduledFor ?? Date.now()), 1).toISOString(),
        },
      ])
      return (await fetchSchedule()).items
    }, c.toast.duplicated).then(() => setDrawerItem(null))

  const reschedule = (id, day) => {
    const item = items.find((x) => x.id === id)
    if (!item || item.status === 'published' || !item.scheduledFor) return
    if (sameDay(new Date(item.scheduledFor), day)) return

    persist(async () => {
      await saveScheduled([{ ...item, scheduledFor: moveToDay(item.scheduledFor, day).toISOString() }])
      return (await fetchSchedule()).items
    }, c.toast.rescheduled)
  }

  const publishNow = async (item) => {
    const mediaId = await publishPost({
      imageUrl: item.imageUrl,
      caption: item.caption,
      postType: item.postType,
      accountId: item.accountId ?? defaultAccountId,
    })

    await persist(async () => {
      await saveScheduled([{ ...item, id: item.id, status: 'published' }])
      return (await fetchSchedule()).items
    }, c.toast.published)

    setDrawerItem(null)
    fetchPosts().then(setPosts).catch(() => {})
    return mediaId
  }

  const scheduleWithAi = async ({ slots, accountIds }) => {
    const drafts = slots.flatMap((slot) =>
      accountIds.map((accountId) => ({
        accountId,
        platform: 'instagram',
        postType: 'FEED',
        caption: '',
        imageUrl: null,
        // Deliberately a draft: a slot with no image cannot publish, and marking
        // it 'scheduled' would put something in the queue that can only fail.
        status: 'draft',
        scheduledFor: slot.toISOString(),
      }))
    )

    await persist(async () => {
      await saveScheduled(drafts)
      return (await fetchSchedule()).items
    })

    setAiOpen(false)
    notify(fill(c.ai.created, { n: drafts.length }))
  }

  const persistSettings = async (next) => {
    const saved = await saveSettings(next)
    setData((prev) => ({ ...prev, settings: saved }))
  }

  // ---------- drawer openers ----------

  const openNew = (day = new Date(), time) => {
    const when = time ? atTime(day, time) : isToday(day) ? new Date(Date.now() + 3600000) : atTime(day, settings?.preferredTimes?.[0] ?? '09:00')
    setDrawerItem({
      accountId: channel === 'all' ? defaultAccountId : channel,
      platform: 'instagram',
      postType: 'FEED',
      imageUrl: null,
      caption: '',
      scheduledFor: when.toISOString(),
      status: 'draft',
    })
  }

  // ---------- period label ----------

  const periodLabel = useMemo(() => {
    if (view === 'day') {
      return new Intl.DateTimeFormat(language, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(anchor)
    }
    if (view === 'week') {
      const start = startOfWeek(anchor)
      const end = addDays(start, 6)
      const fmt = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' })
      return `${fmt.format(start)} – ${fmt.format(end)} ${end.getFullYear()}`
    }
    return new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(anchor)
  }, [view, anchor, language])

  const step = (direction) => {
    if (view === 'day') return setAnchor((d) => addDays(d, direction))
    if (view === 'week') return setAnchor((d) => addDays(d, direction * 7))
    setAnchor((d) => addMonths(d, direction))
  }

  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }),
    [language]
  )
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(language, { weekday: 'short', day: '2-digit', month: 'short' }),
    [language]
  )

  const queueLabel = (item) => {
    const when = new Date(item.scheduledFor)
    if (sameDay(when, new Date())) return timeFmt.format(when)
    if (sameDay(when, addDays(new Date(), 1))) return `${c.tomorrow} · ${timeFmt.format(when)}`
    return `${dayFmt.format(when)} · ${timeFmt.format(when)}`
  }

  if (!data) {
    return (
      <div>
        <ScreenHeader title={c.title} subtitle={c.subtitle} />
        <div className="card flex items-center justify-center gap-3 p-10 text-slate-400">
          <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
          <span className="font-semibold">{c.loading}</span>
        </div>
      </div>
    )
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => openNew()} className="btn-primary !px-4 !py-2.5 !text-[14px]">
        <Plus size={16} strokeWidth={3} />
        {c.createPost}
      </button>
      <button onClick={() => setAiOpen(true)} className="btn-ghost !px-4 !py-2.5 !text-[14px]">
        <Sparkles size={16} strokeWidth={2.5} />
        {c.aiPlan}
      </button>
    </div>
  )

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <ScreenHeader title={c.title} subtitle={c.subtitle} />
        {actions}
      </div>

      {error && (
        <p className="mb-4 rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </p>
      )}

      {accounts.length === 0 && (
        <button
          onClick={onGoToSettings}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50/80 px-4 py-3.5 text-left text-sm font-bold text-amber-900 transition-colors hover:bg-amber-100/80"
        >
          {c.noAccounts}
          <ArrowRight size={17} strokeWidth={2.5} className="shrink-0" />
        </button>
      )}

      {!data.cronConfigured && (
        <p className="mb-4 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/60 px-4 py-3 text-[13px] font-semibold text-amber-900">
          {c.cronOff}
        </p>
      )}

      {/* ---------- Today / next up ---------- */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {c.todayTitle}
          </p>
          <p className="mt-1 text-xl font-extrabold tracking-tight">
            {todayItems.length === 0
              ? c.todayNone
              : todayItems.length === 1
                ? c.todayOne
                : fill(c.todayMany, { n: todayItems.length })}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{c.nextUp}</p>
          {next ? (
            <button onClick={() => setDrawerItem(next)} className="mt-1 block w-full text-left">
              <span className="flex items-center gap-2">
                <span className="text-lg font-extrabold tabular-nums">{queueLabel(next)}</span>
                <span className="text-sm leading-none">{getPlatform(next.platform)?.icon}</span>
                <StatusChip status={next.status} />
              </span>
              <span className="mt-0.5 line-clamp-1 text-[13px] text-slate-500">
                {next.caption?.replace(/\s+/g, ' ').trim() || '—'}
              </span>
            </button>
          ) : (
            <p className="mt-1 text-xl font-extrabold tracking-tight text-slate-400">
              {c.nothingScheduled}
            </p>
          )}
        </div>
      </div>

      {/* ---------- Calendar ---------- */}
      <div className="card mb-5 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => step(-1)}
              aria-label={c.previousPeriod}
              className="grid h-9 w-9 place-items-center rounded-xl border-2 border-slate-200 bg-white/70 text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600"
            >
              <ChevronLeft size={17} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              className="rounded-xl border-2 border-slate-200 bg-white/70 px-3 py-1.5 text-[13px] font-bold text-slate-600 transition-colors hover:border-brand-400 hover:text-brand-600"
            >
              {c.today}
            </button>
            <button
              onClick={() => step(1)}
              aria-label={c.nextPeriod}
              className="grid h-9 w-9 place-items-center rounded-xl border-2 border-slate-200 bg-white/70 text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600"
            >
              <ChevronRight size={17} strokeWidth={2.5} />
            </button>
            <span className="ml-2 text-sm font-extrabold tracking-tight sm:text-base">
              {periodLabel}
            </span>
          </div>

          <div className="flex gap-1">
            {VIEWS.map((id) => (
              <button
                key={id}
                onClick={() => setView(id)}
                aria-pressed={view === id}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  view === id
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {c.views[id]}
              </button>
            ))}
          </div>
        </div>

        {/* Channel filter */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {[{ id: 'all' }, ...accounts].map((account) => {
            const platform = account.id === 'all' ? null : getPlatform(account.platform)
            const active = channel === account.id
            return (
              <button
                key={account.id}
                onClick={() => setChannel(account.id)}
                aria-pressed={active}
                className={`chip border-2 transition-all ${
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white/70 text-slate-500 hover:border-slate-300'
                }`}
              >
                {platform && <span className="text-sm leading-none">{platform.icon}</span>}
                {account.id === 'all' ? c.allChannels : `@${account.username ?? account.externalId}`}
              </button>
            )
          })}
        </div>

        {view === 'week' && (
          <WeekView
            items={visible}
            anchor={anchor}
            onOpen={setDrawerItem}
            onDropPost={reschedule}
            onAdd={openNew}
          />
        )}
        {view === 'day' && (
          <DayView
            items={visible}
            anchor={anchor}
            settings={settings}
            onOpen={setDrawerItem}
            onDropPost={reschedule}
            onAdd={openNew}
          />
        )}
        {view === 'month' && (
          <MonthView
            items={visible}
            anchor={anchor}
            onOpen={setDrawerItem}
            onDropPost={reschedule}
            onAdd={openNew}
          />
        )}
        {view === 'list' &&
          (visible.length === 0 ? (
            <p className="py-8 text-center text-sm font-semibold text-slate-400">
              {c.nothingScheduled}
            </p>
          ) : (
            <ListView
              items={[...visible].sort((a, b) =>
                (b.scheduledFor ?? '').localeCompare(a.scheduledFor ?? '')
              )}
              onOpen={setDrawerItem}
              onDuplicate={duplicate}
              onDelete={remove}
            />
          ))}
      </div>

      {/* ---------- Empty state ---------- */}
      {items.length === 0 && (
        <div className="card mb-5 flex flex-col items-center justify-center gap-3 p-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-300">
            <CalendarClock size={26} strokeWidth={2} />
          </span>
          <div>
            <p className="font-extrabold text-slate-600">{c.empty.title}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">{c.empty.body}</p>
          </div>
          {actions}
          {/* The full editor, for a post that should go out now rather than later. */}
          <button
            onClick={onGoToCreate}
            className="text-[13px] font-bold text-brand-600 transition-colors hover:text-brand-700 hover:underline"
          >
            {c.empty.openEditor}
          </button>
        </div>
      )}

      {/* ---------- Queue + scheduled content ---------- */}
      {queue.length > 0 && (
        <>
          <div className="mb-5">
            <h3 className="mb-3 text-sm font-extrabold text-slate-700">{c.queueTitle}</h3>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {queue.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setDrawerItem(item)}
                    className="card flex w-full items-center gap-3 p-3 text-left transition-shadow hover:shadow-lg"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-base">
                      {getPlatform(item.platform)?.icon ?? '•'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-extrabold tabular-nums text-slate-700">
                        {queueLabel(item)}
                      </span>
                      <span className="line-clamp-1 text-xs text-slate-500">
                        {item.caption?.replace(/\s+/g, ' ').trim() || '—'}
                      </span>
                    </span>
                    <StatusChip status={item.status} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Full width: six columns of real data plus three actions do not fit
              beside anything else without the actions falling off the edge. */}
          <div className="mb-5">
            <h3 className="mb-3 text-sm font-extrabold text-slate-700">{c.scheduledContent}</h3>
            <ListView
              items={queue}
              onOpen={setDrawerItem}
              onDuplicate={duplicate}
              onDelete={remove}
            />
          </div>
        </>
      )}

      {/* ---------- AI card ---------- */}
      {recommendation && (
        <div className="card mb-5 overflow-hidden p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-700">
                <Sparkles size={17} strokeWidth={2.5} className="text-brand-600" />
                {c.ai.cardTitle}
              </h3>
              <p className="mt-1 max-w-lg text-[13px] text-slate-500">{c.ai.cardBody}</p>

              <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {recommendation.source === 'measured'
                  ? fill(c.ai.measured, { n: recommendation.sampleSize })
                  : c.ai.preferred}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {recommendation.times.map((time) => (
                  <span
                    key={time}
                    className="chip border-2 border-brand-200 bg-brand-50 tabular-nums text-brand-700"
                  >
                    <Clock size={12} strokeWidth={2.5} />
                    {time}
                  </span>
                ))}
              </div>

              {recommendation.source === 'preferred' && recommendation.missing > 0 && (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  {fill(c.ai.preferredWhy, { n: recommendation.missing })}
                </p>
              )}
            </div>

            <button onClick={() => setAiOpen(true)} className="btn-primary !px-4 !py-2.5 !text-[14px]">
              <Sparkles size={16} strokeWidth={2.5} />
              {c.aiPlan}
            </button>
          </div>
        </div>
      )}

      {settings && (
        <PublishingSettings settings={settings} onSave={persistSettings} notify={notify} />
      )}

      {drawerItem && (
        <PostDrawer
          item={drawerItem}
          accounts={accounts}
          publishable={publishable}
          onClose={() => setDrawerItem(null)}
          onSave={save}
          onDelete={remove}
          onDuplicate={duplicate}
          onPublishNow={publishNow}
          notify={notify}
        />
      )}

      {aiOpen && recommendation && (
        <AiScheduleModal
          recommendation={recommendation}
          settings={settings}
          accounts={accounts}
          onClose={() => setAiOpen(false)}
          onSchedule={scheduleWithAi}
          notify={notify}
        />
      )}
    </div>
  )
}
