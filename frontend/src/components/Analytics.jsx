import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Clock,
  Eye,
  Heart,
  Hourglass,
  Loader2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { fetchPosts, refreshMetrics } from '../utils/posts'
import {
  bandLabel,
  buildBands,
  interactionsOf,
  isMeasured,
  recommendBand,
  summarise,
} from '../utils/postAnalytics'
import ScreenHeader from './ScreenHeader'

// One sequential hue for every bar. Which band a row is stays in its label, so
// the chart still reads correctly in greyscale. Validated ≥3:1 on the card.
const BAR = '#4f46e5'
const BAR_SOFT = '#e0e7ff'

const fill = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? '').toString())

export default function Analytics({ accounts = [], notify, onGoToCreate }) {
  const { t, language } = useLanguage()
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [channel, setChannel] = useState('all')

  const load = useCallback(async () => {
    try {
      setPosts(await fetchPosts())
      setError(null)
    } catch (e) {
      setError(e.message)
      setPosts([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await refreshMetrics()
      await load()
      notify?.(t.analytics.refreshed)
    } catch (e) {
      notify?.(e.message, 'warn')
    } finally {
      setRefreshing(false)
    }
  }

  const nf = useMemo(() => new Intl.NumberFormat(language), [language])
  // German writes 15,5 % — toFixed would print an English 15.5 either way.
  const pf = useMemo(
    () =>
      new Intl.NumberFormat(language, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [language]
  )
  const dtf = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [language]
  )

  // Posts recorded before accounts existed carry no accountId; they belong to
  // the first connected account, which is the one that published them.
  const defaultAccountId = accounts[0]?.id ?? null

  const scoped = useMemo(() => {
    if (!posts) return null
    if (channel === 'all') return posts
    return posts.filter((post) => (post.accountId ?? defaultAccountId) === channel)
  }, [posts, channel, defaultAccountId])

  const stats = useMemo(() => (scoped ? summarise(scoped) : null), [scoped])
  const bands = useMemo(() => (scoped ? buildBands(scoped) : []), [scoped])
  const advice = useMemo(
    () => (stats ? recommendBand(bands, stats.measured) : null),
    [bands, stats]
  )

  if (posts === null) {
    return (
      <div>
        <ScreenHeader title={t.analytics.title} subtitle={t.analytics.subtitle} />
        <div className="card flex items-center justify-center gap-3 p-10 text-slate-400">
          <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
          <span className="font-semibold">{t.analytics.loading}</span>
        </div>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div>
        <ScreenHeader title={t.analytics.title} subtitle={t.analytics.subtitle} />
        <div className="card flex flex-col items-center justify-center gap-3 p-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-300">
            <BarChart3 size={26} strokeWidth={2} />
          </span>
          <p className="font-bold text-slate-600">{error ?? t.analytics.empty}</p>
          {!error && <p className="max-w-xs text-sm text-slate-400">{t.analytics.emptyHint}</p>}
          <button onClick={onGoToCreate} className="btn-primary mt-1">
            {t.analytics.emptyAction}
            <ArrowRight size={17} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    )
  }

  const tiles = [
    { key: 'published', icon: Sparkles, value: nf.format(stats.published) },
    { key: 'reach', icon: Users, value: nf.format(stats.reach) },
    { key: 'views', icon: Eye, value: nf.format(stats.views) },
    { key: 'likes', icon: Heart, value: nf.format(stats.likes) },
    { key: 'comments', icon: MessageCircle, value: nf.format(stats.comments) },
    {
      key: 'engagement',
      icon: BarChart3,
      value: stats.engagement === null ? '—' : pf.format(stats.engagement / 100),
    },
  ]

  const maxBand = Math.max(...bands.map((b) => b.avgReach), 0)

  return (
    <div>
      <ScreenHeader title={t.analytics.title} subtitle={t.analytics.subtitle} />

      {accounts.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {[{ id: 'all' }, ...accounts].map((account) => {
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
                {account.id === 'all'
                  ? t.schedule.allChannels
                  : `@${account.username ?? account.externalId}`}
              </button>
            )
          })}
        </div>
      )}

      <div className="mb-5">
        <button onClick={refresh} disabled={refreshing} className="btn-ghost">
          <RefreshCw size={16} strokeWidth={2.5} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? t.analytics.refreshing : t.analytics.refresh}
        </button>
      </div>

      {/* ---------- KPI tiles ---------- */}
      <h3 className="mb-3 text-sm font-extrabold text-slate-700">{t.analytics.totals}</h3>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(({ key, icon: Icon, value }) => (
          <div key={key} className="card p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <Icon size={13} strokeWidth={2.5} />
              {t.analytics[key]}
            </p>
            <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink">{value}</p>
          </div>
        ))}
      </div>

      {/* ---------- Best time ---------- */}
      <div className="card mb-8 p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <Clock size={17} strokeWidth={2.5} className="text-brand-600" />
          <h3 className="text-sm font-extrabold text-slate-700">{t.analytics.bestTime}</h3>
        </div>
        <p className="mb-5 text-xs font-semibold text-slate-400">{t.analytics.bestTimeHint}</p>

        {advice.ready ? (
          <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-4">
            <p className="text-lg font-extrabold text-brand-700">
              {fill(t.analytics.recommend, { band: bandLabel(advice.band) })}
            </p>
            <p className="mt-1 text-sm font-semibold text-brand-900/70">
              {fill(t.analytics.recommendDetail, {
                reach: nf.format(Math.round(advice.band.avgReach)),
                count: advice.band.posts,
                runnerBand: bandLabel(advice.runnerUp),
                runnerReach: nf.format(Math.round(advice.runnerUp.avgReach)),
              })}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/60 p-4">
            <p className="flex items-center gap-2 text-base font-extrabold text-amber-800">
              <Hourglass size={17} strokeWidth={2.5} />
              {advice.reason === 'volume'
                ? fill(t.analytics.needMore, { n: advice.missing })
                : t.analytics.needSpread}
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-900/70">
              {advice.reason === 'volume' ? t.analytics.needMoreHint : t.analytics.needSpreadHint}
            </p>
          </div>
        )}

        {/* The measured table is shown regardless — it is fact, not advice. */}
        <h4 className="mb-3 mt-6 text-xs font-extrabold uppercase tracking-wide text-slate-400">
          {t.analytics.byHour}
        </h4>
        <ul className="space-y-3">
          {bands.map((band) => {
            const pct = maxBand > 0 ? (band.avgReach / maxBand) * 100 : 0
            return (
              <li key={band.index}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold tabular-nums text-slate-700">
                    {bandLabel(band)}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-400">
                    {band.posts === 0 ? (
                      t.analytics.noData
                    ) : (
                      <>
                        <span className="text-sm font-extrabold tabular-nums text-ink">
                          {nf.format(Math.round(band.avgReach))}
                        </span>{' '}
                        {t.analytics.reach} ·{' '}
                        {fill(band.posts === 1 ? t.analytics.postsOne : t.analytics.postsMany, {
                          n: band.posts,
                        })}
                      </>
                    )}
                  </span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: BAR_SOFT }}
                  role="img"
                  aria-label={`${bandLabel(band)}: ${nf.format(Math.round(band.avgReach))} ${
                    t.analytics.reach
                  } ${t.analytics.perPost}`}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      // A band that was posted in but reached nobody gets no
                      // bar at all — a minimum-width sliver would read as "some".
                      width: `${band.avgReach === 0 ? 0 : Math.max(pct, 2)}%`,
                      backgroundColor: BAR,
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ---------- History ---------- */}
      <h3 className="mb-3 text-sm font-extrabold text-slate-700">{t.analytics.history}</h3>
      <ul className="space-y-3">
        {scoped.map((post) => {
          const m = post.metrics
          return (
            <li key={post.id} className="card flex gap-3 p-3 sm:gap-4 sm:p-4">
              {post.imageUrl ? (
                <img
                  src={post.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-24 sm:w-24"
                />
              ) : (
                <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-300 sm:h-24 sm:w-24">
                  <BarChart3 size={20} strokeWidth={2} />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-extrabold tabular-nums text-slate-700">
                    {dtf.format(new Date(post.publishedAt))}
                  </span>
                  <span className="chip bg-slate-100 text-slate-500">
                    {t.create.postTypes[post.postType] ?? post.postType}
                  </span>
                </div>

                <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-slate-500">
                  {post.caption || '—'}
                </p>

                {isMeasured(post) ? (
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {[
                      { icon: Users, label: t.analytics.reach, value: m.reach ?? 0 },
                      { icon: Heart, label: t.analytics.likes, value: m.likes ?? 0 },
                      { icon: MessageCircle, label: t.analytics.comments, value: m.comments ?? 0 },
                      { icon: Sparkles, label: t.analytics.interactions, value: interactionsOf(m) },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <Icon size={13} strokeWidth={2.5} className="text-slate-400" />
                        <dt className="sr-only">{label}</dt>
                        <dd className="text-sm font-extrabold tabular-nums text-ink">
                          {nf.format(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700"
                    title={t.analytics.pendingHint}
                  >
                    <Hourglass size={13} strokeWidth={2.5} />
                    {t.analytics.pending}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
