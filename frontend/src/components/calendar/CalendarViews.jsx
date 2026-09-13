import React from 'react'
import { Plus } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { addDays, isToday, monthGrid, sameDay, startOfDay, weekDays } from '../../utils/calendar'
import PostCard from './PostCard'

/** Posts falling on one day, earliest first. */
const onDay = (items, day) =>
  items
    .filter((item) => item.scheduledFor && sameDay(new Date(item.scheduledFor), day))
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))

/**
 * A day cell that accepts a dragged post.
 *
 * Dropping only ever changes the date and keeps the time of day, which is the
 * one rescheduling move that cannot produce a slot the user did not choose.
 */
function DropZone({ day, onDropPost, children, className = '' }) {
  const [over, setOver] = React.useState(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDropPost(id, day)
      }}
      className={`${className} ${over ? 'ring-2 ring-brand-400 ring-offset-1' : ''}`}
    >
      {children}
    </div>
  )
}

const dragStart = (e, item) => {
  e.dataTransfer.setData('text/plain', item.id)
  e.dataTransfer.effectAllowed = 'move'
}

function DayHeader({ day, language, compact = false }) {
  const today = isToday(day)
  return (
    <div className="mb-2 flex items-baseline gap-1.5">
      <span
        className={`text-[11px] font-extrabold uppercase tracking-wide ${
          today ? 'text-brand-600' : 'text-slate-400'
        }`}
      >
        {new Intl.DateTimeFormat(language, { weekday: 'short' }).format(day)}
      </span>
      <span
        className={`grid h-6 min-w-6 place-items-center rounded-lg px-1 text-[13px] font-extrabold tabular-nums ${
          today ? 'text-white' : 'text-slate-700'
        }`}
        style={today ? { backgroundImage: 'var(--grad-brand)' } : undefined}
      >
        {day.getDate()}
      </span>
    </div>
  )
}

export function WeekView({ items, anchor, onOpen, onDropPost, onAdd }) {
  const { t, language } = useLanguage()
  const days = weekDays(anchor)

  return (
    // Seven readable columns never fit a phone, so the week scrolls sideways
    // rather than collapsing into something that is no longer a week.
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      {/* items-start, or an empty Monday would stretch to the height of the
          busiest day and the week would read as mostly whitespace. */}
      <div className="grid min-w-[840px] grid-cols-7 items-start gap-2">
        {days.map((day) => {
          const dayItems = onDay(items, day)
          return (
            <DropZone
              key={day.toISOString()}
              day={day}
              onDropPost={onDropPost}
              className={`min-h-[112px] rounded-2xl border p-2 transition-colors ${
                isToday(day) ? 'border-brand-200 bg-brand-50/40' : 'border-slate-200/70 bg-white/60'
              }`}
            >
              <DayHeader day={day} language={language} />

              <div className="space-y-1.5">
                {dayItems.map((item) => (
                  <PostCard
                    key={item.id}
                    item={item}
                    onOpen={onOpen}
                    draggable
                    onDragStart={dragStart}
                  />
                ))}
              </div>

              <button
                onClick={() => onAdd(day)}
                aria-label={t.schedule.createPost}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-1.5 text-[11px] font-bold text-slate-300 transition-colors hover:border-brand-300 hover:text-brand-500"
              >
                <Plus size={12} strokeWidth={3} />
              </button>
            </DropZone>
          )
        })}
      </div>
    </div>
  )
}

export function DayView({ items, anchor, settings, onOpen, onDropPost, onAdd }) {
  const { t, language } = useLanguage()
  const day = startOfDay(anchor)
  const dayItems = onDay(items, day)

  // Preferred times the day has nothing in yet, offered as one-tap slots.
  const free = (settings?.preferredTimes ?? []).filter(
    (time) => !dayItems.some((item) => time === new Date(item.scheduledFor).toTimeString().slice(0, 5))
  )

  return (
    <DropZone
      day={day}
      onDropPost={onDropPost}
      className="rounded-2xl border border-slate-200/70 bg-white/60 p-3 sm:p-4"
    >
      <p className="mb-3 text-sm font-extrabold text-slate-700">
        {new Intl.DateTimeFormat(language, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(day)}
      </p>

      {dayItems.length === 0 && free.length === 0 ? (
        <p className="py-6 text-center text-sm font-semibold text-slate-400">
          {t.schedule.nothingScheduled}
        </p>
      ) : (
        <div className="space-y-2">
          {dayItems.map((item) => (
            <PostCard key={item.id} item={item} onOpen={onOpen} draggable onDragStart={dragStart} />
          ))}

          {free.map((time) => (
            <button
              key={time}
              onClick={() => onAdd(day, time)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="text-[11px] font-extrabold tabular-nums text-slate-400">{time}</span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                <Plus size={12} strokeWidth={3} />
                {t.schedule.createPost}
              </span>
            </button>
          ))}
        </div>
      )}
    </DropZone>
  )
}

export function MonthView({ items, anchor, onOpen, onDropPost, onAdd }) {
  const { t, language } = useLanguage()
  const days = monthGrid(anchor)
  const month = anchor.getMonth()

  const weekdayNames = weekDays(new Date()).map((d) =>
    new Intl.DateTimeFormat(language, { weekday: 'short' }).format(d)
  )

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="min-w-[720px]">
        <div className="mb-1.5 grid grid-cols-7 gap-1.5">
          {weekdayNames.map((name) => (
            <span
              key={name}
              className="px-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-400"
            >
              {name}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const dayItems = onDay(items, day)
            const outside = day.getMonth() !== month
            const shown = dayItems.slice(0, 2)

            return (
              <DropZone
                key={day.toISOString()}
                day={day}
                onDropPost={onDropPost}
                className={`min-h-[92px] rounded-xl border p-1.5 transition-colors ${
                  isToday(day)
                    ? 'border-brand-200 bg-brand-50/40'
                    : outside
                      ? 'border-slate-100 bg-slate-50/50'
                      : 'border-slate-200/70 bg-white/60'
                }`}
              >
                <button
                  onClick={() => onAdd(day)}
                  className={`mb-1 block text-[12px] font-extrabold tabular-nums transition-colors hover:text-brand-600 ${
                    outside ? 'text-slate-300' : isToday(day) ? 'text-brand-600' : 'text-slate-600'
                  }`}
                >
                  {day.getDate()}
                </button>

                <div className="space-y-1">
                  {shown.map((item) => (
                    <PostCard
                      key={item.id}
                      item={item}
                      onOpen={onOpen}
                      draggable
                      onDragStart={dragStart}
                    />
                  ))}
                </div>

                {dayItems.length > shown.length && (
                  <p className="mt-1 px-1 text-[10px] font-bold text-slate-400">
                    {t.schedule.morePosts.replace('{n}', dayItems.length - shown.length)}
                  </p>
                )}
              </DropZone>
            )
          })}
        </div>
      </div>
    </div>
  )
}
