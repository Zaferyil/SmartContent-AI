import React, { useState } from 'react'
import { ChevronDown, Loader2, Minus, Plus, Settings2, X } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { browserTimezone } from '../../utils/calendar'

const ZONES = [
  'Europe/Vienna',
  'Europe/Berlin',
  'Europe/Zurich',
  'Europe/Istanbul',
  'Europe/London',
  'UTC',
]

/**
 * Secondary by design: collapsed until asked for.
 *
 * These controls used to be the whole screen, which made a content calendar
 * look like a cron editor. They still matter — preferred times are what AI
 * planning falls back to — but the content comes first.
 */
export default function PublishingSettings({ settings, onSave, notify }) {
  const { t } = useLanguage()
  const s = t.schedule.settings

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)

  const browser = browserTimezone()
  const mismatch = browser && browser !== draft.timezone

  const save = async (next) => {
    setDraft(next)
    setSaving(true)
    try {
      await onSave(next)
      notify(s.saved)
    } catch (error) {
      notify(error.message, 'warn')
      setDraft(settings)
    } finally {
      setSaving(false)
    }
  }

  const [newTime, setNewTime] = useState('12:00')

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-extrabold text-slate-700">
          <Settings2 size={16} strokeWidth={2.5} className="text-slate-400" />
          {s.title}
        </span>
        <span className="flex items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin text-slate-400" />}
          <ChevronDown
            size={18}
            strokeWidth={2.5}
            className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-200/70 px-5 py-5">
          <div>
            <label className="label" htmlFor="tz">
              {s.timezone}
            </label>
            <select
              id="tz"
              value={draft.timezone}
              onChange={(e) => save({ ...draft, timezone: e.target.value })}
              className="field"
            >
              {[...new Set([draft.timezone, browser, ...ZONES].filter(Boolean))].map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            {mismatch && (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                {s.tzMismatch.replace('{browser}', browser)}
              </p>
            )}
          </div>

          <div>
            <span className="label">{s.postsPerDay}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => save({ ...draft, postsPerDay: Math.max(1, draft.postsPerDay - 1) })}
                aria-label="-"
                className="grid h-10 w-10 place-items-center rounded-xl border-2 border-slate-200 bg-white/70 text-slate-600 transition-colors hover:border-brand-400"
              >
                <Minus size={15} strokeWidth={3} />
              </button>
              <span className="min-w-8 text-center text-xl font-extrabold tabular-nums">
                {draft.postsPerDay}
              </span>
              <button
                onClick={() => save({ ...draft, postsPerDay: Math.min(12, draft.postsPerDay + 1) })}
                aria-label="+"
                className="grid h-10 w-10 place-items-center rounded-xl border-2 border-slate-200 bg-white/70 text-slate-600 transition-colors hover:border-brand-400"
              >
                <Plus size={15} strokeWidth={3} />
              </button>
            </div>
          </div>

          <div>
            <span className="label">{s.preferredTimes}</span>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {draft.preferredTimes.map((time) => (
                <span key={time} className="chip border-2 border-slate-200 bg-white/70 text-slate-600">
                  {time}
                  {draft.preferredTimes.length > 1 && (
                    <button
                      onClick={() =>
                        save({
                          ...draft,
                          preferredTimes: draft.preferredTimes.filter((x) => x !== time),
                        })
                      }
                      aria-label={`${s.preferredTimes} – ${time}`}
                      className="text-slate-300 transition-colors hover:text-rose-500"
                    >
                      <X size={13} strokeWidth={3} />
                    </button>
                  )}
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="field !w-auto !py-2.5"
              />
              <button
                onClick={() =>
                  save({
                    ...draft,
                    preferredTimes: [...new Set([...draft.preferredTimes, newTime])].sort(),
                  })
                }
                className="btn-ghost !px-4 !py-2.5 !text-[13px]"
              >
                <Plus size={15} strokeWidth={3} />
                {s.addTime}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
