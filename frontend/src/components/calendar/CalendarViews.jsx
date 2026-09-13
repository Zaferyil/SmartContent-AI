import React from 'react'
import { Plus } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { addDays, isToday, monthGrid, sameDay, startOfDay, weekDays } from '../../utils/calendar'
import PostCard from './PostCard'
import { STATUS_LOOKS } from './StatusChip'

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
    /*
     * Seven readable columns need about 800px, which is more than a phone has.
     * This used to force that width and scroll sideways, so a phone showed
     * three days and no way to know the other four were there.
     *
     * Below md the week is seven full-width rows instead — every day on screen,
     * in order, at a size the posts are actually legible at. From md up it is
     * the grid again, where the shape of the week is the point.
     *
     * items-start on the grid, or an empty Monday would stretch to the height
     * of the busiest day and the week would read as mostly whitespace.
     */
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7 md:items-start">
      {days.map((day) => {
        const dayItems = onDay(items, day)
        return (
          <DropZone
            key={day.toISOString()}
            day={day}
            onDropPost={onDropPost}
            className={`rounded-2xl border p-2 transition-colors md:min-h-[112px] ${
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

export function MonthView({ items, anchor, onOpen, onDropPost, onAdd, onPickDay }) {
  const { t, language } = useLanguage()
  const days = monthGrid(anchor)
  const month = anchor.getMonth()

  // One letter on a phone: "Mo Di Mi" in a 50px column wraps and pushes the
  // grid out of alignment, and the column position already says which day it is.
  const weekdayNames = weekDays(new Date()).map((d) => ({
    short: new Intl.DateTimeFormat(language, { weekday: 'short' }).format(d),
    narrow: new Intl.DateTimeFormat(language, { weekday: 'narrow' }).format(d),
  }))

  return (
    /*
     * A month has to stay seven columns wide — that shape is the whole point of
     * the view — so it cannot stack the way the week does. It fits a phone
     * instead: no forced width, and inside each cell the post cards give way to
     * a dot per post, which is all that is legible at 50px anyway.
     *
     * Tapping a cell then opens that day, where there is room for the posts and
     * for planning. From md up nothing changes: cards and an add button, as
     * before.
     */
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1 md:gap-1.5">
        {weekdayNames.map(({ short, narrow }) => (
          <span
            key={short}
            className="text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-400 md:px-1 md:text-left md:text-[11px]"
          >
            <span className="md:hidden">{narrow}</span>
            <span className="hidden md:inline">{short}</span>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-1.5">
          {days.map((day) => {
            const dayItems = onDay(items, day)
            const outside = day.getMonth() !== month
            const shown = dayItems.slice(0, 2)

            return (
              <DropZone
                key={day.toISOString()}
                day={day}
                onDropPost={onDropPost}
                className={`flex min-h-[56px] flex-col rounded-lg border p-1 transition-colors md:min-h-[92px] md:rounded-xl md:p-1.5 ${
                  isToday(day)
                    ? 'border-brand-200 bg-brand-50/40'
                    : outside
                      ? 'border-slate-100 bg-slate-50/50'
                      : 'border-slate-200/70 bg-white/60'
                }`}
              >
                {/* Phone: the whole cell opens that day, because a 50px box has
                    no room for a post and an add button that are told apart by
                    aim. Everything below it is md-only. */}
                <button
                  onClick={() => onPickDay?.(day)}
                  aria-label={new Intl.DateTimeFormat(language, { dateStyle: 'full' }).format(day)}
                  className="flex flex-1 flex-col items-center gap-1 pt-0.5 md:hidden"
                >
                  <span
                    className={`text-[12px] font-extrabold tabular-nums ${
                      outside ? 'text-slate-300' : isToday(day) ? 'text-brand-600' : 'text-slate-600'
                    }`}
                  >
                    {day.getDate()}
                  </span>

                  {dayItems.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      {dayItems.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            (STATUS_LOOKS[item.status] ?? STATUS_LOOKS.draft).className.split(' ')[0]
                          }`}
                        />
                      ))}
                      {dayItems.length > 3 && (
                        <span className="text-[9px] font-bold leading-none text-slate-400">
                          +{dayItems.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </button>

                <span
                  className={`mb-1 hidden text-[12px] font-extrabold tabular-nums md:block ${
                    outside ? 'text-slate-300' : isToday(day) ? 'text-brand-600' : 'text-slate-600'
                  }`}
                >
                  {day.getDate()}
                </span>

                <div className="hidden space-y-1 md:block">
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
                  <p className="mt-1 hidden px-1 text-[10px] font-bold text-slate-400 md:block">
                    {t.schedule.morePosts.replace('{n}', dayItems.length - shown.length)}
                  </p>
                )}

                {/* The same add button the week has. The date used to be the
                    button, which nothing about a bare number suggests — so the
                    month was the one view you could not plan from. mt-auto
                    keeps it on the cell floor, so the row of buttons stays
                    straight however many posts a day holds. */}
                <button
                  onClick={() => onAdd(day)}
                  aria-label={t.schedule.createPost}
                  className="mt-auto hidden w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 py-1 text-[11px] font-bold text-slate-300 transition-colors hover:border-brand-300 hover:text-brand-500 md:flex"
                >
                  <Plus size={11} strokeWidth={3} />
                </button>
              </DropZone>
            )
          })}
      </div>
    </div>
  )
}
