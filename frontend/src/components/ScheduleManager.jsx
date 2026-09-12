import React, { useState } from 'react'
import { Plus, Trash2, CalendarClock, ArrowRight } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { getPlatform } from '../data/platforms'
import ScreenHeader from './ScreenHeader'

const INTERVALS = [1, 2, 3, 4, 6, 8, 12, 24]

/** Expands a plan into the clock times each post will go out at. */
function buildTimes(startTime, intervalHours, count) {
  const [h, m] = startTime.split(':').map(Number)
  const base = h * 60 + m
  return Array.from({ length: count }, (_, i) => {
    const total = base + i * intervalHours * 60
    const hh = String(Math.floor(total / 60) % 24).padStart(2, '0')
    const mm = String(total % 60).padStart(2, '0')
    const dayOffset = Math.floor(total / 1440)
    return { label: `${hh}:${mm}`, dayOffset }
  })
}

export default function ScheduleManager({ selected, notify, onGoToPlatforms }) {
  const { t } = useLanguage()
  const [startTime, setStartTime] = useState('09:00')
  const [interval, setInterval] = useState(24)
  const [count, setCount] = useState(3)
  const [plans, setPlans] = useState([])

  const preview = buildTimes(startTime, interval, count)

  const add = () => {
    if (selected.length === 0) return notify(t.schedule.needPlatform, 'warn')
    setPlans((prev) => [
      ...prev,
      { id: Date.now(), startTime, interval, count, platforms: [...selected] },
    ])
    notify(t.schedule.added)
  }

  const remove = (id) => {
    setPlans((prev) => prev.filter((p) => p.id !== id))
    notify(t.schedule.removed)
  }

  return (
    <div>
      <ScreenHeader title={t.schedule.title} subtitle={t.schedule.subtitle} />

      {selected.length === 0 && (
        <button
          onClick={onGoToPlatforms}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50/80 px-4 py-3.5 text-left text-sm font-bold text-amber-900 transition-colors hover:bg-amber-100/80"
        >
          {t.schedule.needPlatform}
          <ArrowRight size={17} strokeWidth={2.5} className="shrink-0" />
        </button>
      )}

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        {/* ---------- Builder ---------- */}
        <div className="card space-y-5 p-5 sm:p-6 lg:col-span-2">
          <div>
            <label className="label" htmlFor="start">
              {t.schedule.startLabel}
            </label>
            <input
              id="start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="field"
            />
          </div>

          <div>
            <span className="label">{t.schedule.intervalLabel}</span>
            <div className="grid grid-cols-4 gap-2">
              {INTERVALS.map((h) => {
                const active = interval === h
                return (
                  <button
                    key={h}
                    onClick={() => setInterval(h)}
                    className={`rounded-xl py-2.5 text-sm font-extrabold transition-all ${
                      active
                        ? 'text-white shadow-md shadow-brand-500/25'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    style={active ? { backgroundImage: 'var(--grad-brand)' } : undefined}
                  >
                    {h}s
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-400">
              {interval} {t.schedule.everyHours}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="count">
              {t.schedule.countLabel}
            </label>
            <div className="flex items-center gap-3">
              <input
                id="count"
                type="range"
                min="1"
                max="12"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500"
              />
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-extrabold text-white"
                style={{ backgroundImage: 'var(--grad-brand)' }}
              >
                {count}
              </span>
            </div>
          </div>

          {/* Live preview of resulting times */}
          <div>
            <span className="label">{t.schedule.preview}</span>
            <div className="flex flex-wrap gap-1.5">
              {preview.map((slot, i) => (
                <span
                  key={i}
                  className="chip border-2 border-slate-200 bg-white/70 text-slate-600"
                >
                  {slot.label}
                  {slot.dayOffset > 0 && (
                    <sup className="text-[9px] font-extrabold text-brand-500">+{slot.dayOffset}</sup>
                  )}
                </span>
              ))}
            </div>
          </div>

          <button onClick={add} className="btn-primary w-full">
            <Plus size={18} strokeWidth={3} />
            {t.schedule.add}
          </button>
        </div>

        {/* ---------- Active plans ---------- */}
        <div className="lg:col-span-3">
          <h3 className="mb-3 text-sm font-extrabold text-slate-700">{t.schedule.activeTitle}</h3>

          {plans.length === 0 ? (
            <div className="card flex flex-col items-center justify-center gap-3 p-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-300">
                <CalendarClock size={26} strokeWidth={2} />
              </span>
              <div>
                <p className="font-bold text-slate-500">{t.schedule.empty}</p>
                <p className="mt-1 text-sm text-slate-400">{t.schedule.emptyHint}</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {plans.map((plan) => (
                <li key={plan.id} className="card overflow-hidden p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-extrabold tracking-tight">
                        {plan.startTime}
                        <span className="ml-2 text-sm font-bold text-slate-400">
                          · {plan.interval} {t.schedule.everyHours}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-500">
                        {plan.count} {t.schedule.posts}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(plan.id)}
                      aria-label={t.schedule.delete}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100"
                    >
                      <Trash2 size={17} strokeWidth={2.5} />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {plan.platforms.map((id) => {
                      const p = getPlatform(id)
                      if (!p) return null
                      return (
                        <span
                          key={id}
                          className={`chip bg-gradient-to-br text-white ${p.gradient}`}
                        >
                          <span className="text-sm leading-none">{p.icon}</span>
                          {p.name}
                        </span>
                      )
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                    {buildTimes(plan.startTime, plan.interval, plan.count).map((slot, i) => (
                      <span key={i} className="chip bg-slate-100 text-slate-500">
                        {slot.label}
                        {slot.dayOffset > 0 && (
                          <sup className="text-[9px] font-extrabold text-brand-500">
                            +{slot.dayOffset}
                          </sup>
                        )}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
