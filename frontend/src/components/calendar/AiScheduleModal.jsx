import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Minus, Plus, Sparkles, X } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { getPlatform } from '../../data/platforms'
import { addDays, toDateInput } from '../../utils/calendar'
import { GOALS, planSlots, STRATEGIES } from '../../utils/aiSchedule'

const fill = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? '').toString())

/**
 * Lays empty drafts across a period at the recommended times.
 *
 * It creates slots, not content — and the modal says so before the user
 * commits, because "scheduled 6 posts" that turn out to be six blanks is the
 * kind of success message that costs more trust than it buys.
 */
export default function AiScheduleModal({
  recommendation,
  settings,
  channels,
  publishable,
  onClose,
  onSchedule,
  notify,
}) {
  const { t, language } = useLanguage()
  const a = t.schedule.ai

  const usable = (channels.length ? channels : ['instagram']).filter((id) =>
    publishable.includes(id)
  )

  const [count, setCount] = useState(3)
  const [picked, setPicked] = useState(usable.slice(0, 1))
  const [from, setFrom] = useState(toDateInput(new Date()))
  const [to, setTo] = useState(toDateInput(addDays(new Date(), 13)))
  const [strategy, setStrategy] = useState('engagement')
  const [goal, setGoal] = useState('engagement')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const slots = useMemo(
    () =>
      planSlots({
        from: new Date(`${from}T00:00:00`),
        to: new Date(`${to}T00:00:00`),
        count,
        strategy,
        recommended: recommendation.times,
        preferredTimes: settings.preferredTimes,
      }),
    [from, to, count, strategy, recommendation.times, settings.preferredTimes]
  )

  const tf = new Intl.DateTimeFormat(language, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const submit = async () => {
    if (picked.length === 0) return notify(t.schedule.needPlatform, 'warn')
    if (slots.length === 0) return notify(a.noRoom, 'warn')

    setBusy(true)
    try {
      await onSchedule({ slots, platforms: picked, goal })
    } catch (error) {
      notify(error.message, 'warn')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // Portalled for the same reason as the drawer: the screen wrapper's entry
  // animation leaves a transform, which would otherwise anchor this to it.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        aria-label={t.common.close}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={a.modalTitle}
        className="card relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none sm:max-w-lg sm:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
            <Sparkles size={18} strokeWidth={2.5} className="text-brand-600" />
            {a.modalTitle}
          </h2>
          <button
            onClick={onClose}
            aria-label={t.common.close}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* ---------- Count ---------- */}
          <div>
            <span className="label">{a.count}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCount((n) => Math.max(1, n - 1))}
                aria-label="-"
                className="grid h-11 w-11 place-items-center rounded-xl border-2 border-slate-200 bg-white/70 text-slate-600 transition-colors hover:border-brand-400"
              >
                <Minus size={16} strokeWidth={3} />
              </button>
              <span className="min-w-10 text-center text-2xl font-extrabold tabular-nums">
                {count}
              </span>
              <button
                onClick={() => setCount((n) => Math.min(30, n + 1))}
                aria-label="+"
                className="grid h-11 w-11 place-items-center rounded-xl border-2 border-slate-200 bg-white/70 text-slate-600 transition-colors hover:border-brand-400"
              >
                <Plus size={16} strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* ---------- Channels ---------- */}
          <div>
            <span className="label">{a.channels}</span>
            <div className="flex flex-wrap gap-1.5">
              {usable.map((id) => {
                const p = getPlatform(id)
                if (!p) return null
                const on = picked.includes(id)
                return (
                  <button
                    key={id}
                    onClick={() => toggle(id)}
                    aria-pressed={on}
                    className={`chip border-2 transition-all ${
                      on
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

          {/* ---------- Period ---------- */}
          <div>
            <span className="label">{a.period}</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400" htmlFor="ai-from">
                  {a.from}
                </label>
                <input
                  id="ai-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="field !py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400" htmlFor="ai-to">
                  {a.to}
                </label>
                <input
                  id="ai-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="field !py-2.5"
                />
              </div>
            </div>
          </div>

          {/* ---------- Strategy ---------- */}
          <div>
            <span className="label">{a.strategy}</span>
            <div className="space-y-1.5">
              {STRATEGIES.map((id) => (
                <label
                  key={id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-sm font-bold transition-all ${
                    strategy === id
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white/70 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === id}
                    onChange={() => setStrategy(id)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  {a.strategies[id]}
                </label>
              ))}
            </div>

            {strategy === 'engagement' && recommendation.source === 'preferred' && (
              <p className="mt-2 rounded-xl bg-amber-50/70 px-3 py-2 text-xs font-semibold text-amber-900">
                {fill(a.preferredWhy, { n: recommendation.missing })}
              </p>
            )}
          </div>

          {/* ---------- Goal ---------- */}
          <div>
            <span className="label">{a.goal}</span>
            <div className="flex flex-wrap gap-1.5">
              {GOALS.map((id) => (
                <button
                  key={id}
                  onClick={() => setGoal(id)}
                  aria-pressed={goal === id}
                  className={`chip border-2 transition-all ${
                    goal === id
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white/70 text-slate-500'
                  }`}
                >
                  {a.goals[id]}
                </button>
              ))}
            </div>
          </div>

          {/* ---------- What will actually happen ---------- */}
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 p-3.5">
            <p className="text-xs font-semibold text-slate-500">
              {slots.length === 0 ? a.noRoom : fill(a.slotsNote, { n: slots.length * picked.length })}
            </p>
            {slots.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {slots.slice(0, 8).map((slot) => (
                  <span key={slot.toISOString()} className="chip bg-slate-100 text-slate-600">
                    {tf.format(slot)}
                  </span>
                ))}
                {slots.length > 8 && (
                  <span className="chip bg-slate-100 text-slate-400">
                    {fill(t.schedule.morePosts, { n: slots.length - 8 })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <footer
          className="border-t border-slate-200/70 px-5 py-4"
          style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}
        >
          <button
            onClick={submit}
            disabled={busy || slots.length === 0}
            className="btn-primary w-full"
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" strokeWidth={2.5} />
            ) : (
              <Sparkles size={18} strokeWidth={2.5} />
            )}
            {a.submit}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
