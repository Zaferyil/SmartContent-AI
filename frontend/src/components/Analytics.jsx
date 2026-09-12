import React, { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, ArrowRight, BarChart3 } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { DEMO_METRICS, getPlatform } from '../data/platforms'
import ScreenHeader from './ScreenHeader'

const RANGES = [
  { id: 7, key: 'range7', factor: 0.24 },
  { id: 30, key: 'range30', factor: 1 },
  { id: 90, key: 'range90', factor: 2.7 },
]

// Single sequential hue for the comparison bars — identity is carried by the
// row label and icon, never by colour. Validated ≥3:1 on the card surface.
const BAR = '#4f46e5'
const BAR_SOFT = '#e0e7ff'

const METRICS = ['views', 'likes', 'comments', 'followers']

export default function Analytics({ selected, onGoToPlatforms }) {
  const { t, language } = useLanguage()
  const [range, setRange] = useState(30)
  const [metric, setMetric] = useState('views')

  const factor = RANGES.find((r) => r.id === range)?.factor ?? 1
  const nf = useMemo(() => new Intl.NumberFormat(language), [language])

  const compact = (n) => {
    if (n >= 1000) return `${nf.format(Math.round(n / 100) / 10)}K`
    return nf.format(Math.round(n))
  }

  const rows = useMemo(
    () =>
      selected
        .map((id) => {
          const p = getPlatform(id)
          const raw = DEMO_METRICS[id]
          if (!p || !raw) return null
          return {
            id,
            name: p.name,
            icon: p.icon,
            views: raw.views * factor,
            likes: raw.likes * factor,
            comments: raw.comments * factor,
            followers: raw.followers,
            engagement: raw.engagement,
            trend: raw.trend,
          }
        })
        .filter(Boolean)
        .sort((a, b) => b[metric] - a[metric]),
    [selected, factor, metric]
  )

  const totals = useMemo(() => {
    if (rows.length === 0) return null
    return {
      views: rows.reduce((s, r) => s + r.views, 0),
      likes: rows.reduce((s, r) => s + r.likes, 0),
      comments: rows.reduce((s, r) => s + r.comments, 0),
      followers: rows.reduce((s, r) => s + r.followers, 0),
      engagement: rows.reduce((s, r) => s + r.engagement, 0) / rows.length,
      trend: rows.reduce((s, r) => s + r.trend, 0) / rows.length,
    }
  }, [rows])

  if (rows.length === 0) {
    return (
      <div>
        <ScreenHeader title={t.analytics.title} subtitle={t.analytics.subtitle} />
        <div className="card flex flex-col items-center justify-center gap-4 p-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-300">
            <BarChart3 size={26} strokeWidth={2} />
          </span>
          <p className="font-bold text-slate-500">{t.analytics.empty}</p>
          <button onClick={onGoToPlatforms} className="btn-primary">
            {t.analytics.emptyAction}
            <ArrowRight size={17} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    )
  }

  const max = Math.max(...rows.map((r) => r[metric]))

  const tiles = [
    { key: 'views', value: compact(totals.views) },
    { key: 'likes', value: compact(totals.likes) },
    { key: 'comments', value: compact(totals.comments) },
    { key: 'followers', value: compact(totals.followers) },
    { key: 'engagement', value: `${totals.engagement.toFixed(1)}%` },
  ]

  return (
    <div>
      <ScreenHeader title={t.analytics.title} subtitle={t.analytics.subtitle} />

      {/* Filter row — sits above the data, per interaction rules */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {RANGES.map((r) => {
          const active = range === r.id
          return (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                active
                  ? 'text-white shadow-md shadow-brand-500/25'
                  : 'bg-white/70 text-slate-600 hover:bg-white'
              }`}
              style={active ? { backgroundImage: 'var(--grad-brand)' } : undefined}
            >
              {t.analytics[r.key]}
            </button>
          )
        })}
      </div>

      {/* ---------- KPI row: stat tiles, no plot ---------- */}
      <h3 className="mb-3 text-sm font-extrabold text-slate-700">{t.analytics.totals}</h3>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(({ key, value }) => (
          <div key={key} className="card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {t.analytics[key]}
            </p>
            <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ---------- Comparison bars: one hue, magnitude by length ---------- */}
      <div className="card mb-6 p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold text-slate-700">{t.analytics.byPlatform}</h3>
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map((m) => {
              const active = metric === m
              return (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {t.analytics[m]}
                </button>
              )
            })}
          </div>
        </div>

        <ul className="space-y-3.5">
          {rows.map((row) => {
            const pct = max > 0 ? (row[metric] / max) * 100 : 0
            return (
              <li key={row.id} className="group">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-base leading-none">{row.icon}</span>
                    <span className="truncate text-sm font-bold text-slate-700">{row.name}</span>
                  </span>
                  {/* Direct label on every bar — values readable without colour */}
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-ink">
                    {compact(row[metric])}
                  </span>
                </div>

                <div
                  className="h-2.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: BAR_SOFT }}
                  role="img"
                  aria-label={`${row.name}: ${compact(row[metric])}`}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: BAR }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ---------- Per-channel detail ---------- */}
      <h3 className="mb-3 text-sm font-extrabold text-slate-700">{t.analytics.topContent}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const up = row.trend >= 0
          const Trend = up ? TrendingUp : TrendingDown
          return (
            <div key={row.id} className="card p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="text-xl leading-none">{row.icon}</span>
                  <span className="font-extrabold">{row.name}</span>
                </span>
                {/* Status cue pairs icon + signed label — never colour alone */}
                <span
                  className={`chip ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
                >
                  <Trend size={13} strokeWidth={3} />
                  {up ? '+' : ''}
                  {row.trend.toFixed(1)}%
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-y-3">
                <div>
                  <dt className="text-[11px] font-bold uppercase text-slate-400">
                    {t.analytics.views}
                  </dt>
                  <dd className="text-lg font-extrabold tabular-nums">{compact(row.views)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase text-slate-400">
                    {t.analytics.likes}
                  </dt>
                  <dd className="text-lg font-extrabold tabular-nums">{compact(row.likes)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase text-slate-400">
                    {t.analytics.comments}
                  </dt>
                  <dd className="text-lg font-extrabold tabular-nums">{compact(row.comments)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase text-slate-400">
                    {t.analytics.engagement}
                  </dt>
                  <dd className="text-lg font-extrabold tabular-nums">{row.engagement.toFixed(1)}%</dd>
                </div>
              </dl>

              <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] font-semibold text-slate-400">
                {t.analytics.vsPrevious}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
