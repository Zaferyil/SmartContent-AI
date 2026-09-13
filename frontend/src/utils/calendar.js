/**
 * Date arithmetic for the calendar grid.
 *
 * Everything here works in the browser's own timezone and the store keeps ISO
 * instants, so a slot means the same moment wherever it is read. No library:
 * the calendar needs a week grid, a month grid and "is this the same day",
 * and all three are a few lines each against Date.
 */

export const MS_DAY = 86400000

export const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export const addMonths = (date, months) => {
  const d = new Date(date)
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  return d
}

/** Monday-first, as every European calendar is. */
export const startOfWeek = (date) => {
  const d = startOfDay(date)
  const weekday = (d.getDay() + 6) % 7
  return addDays(d, -weekday)
}

export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export const isToday = (date) => sameDay(date, new Date())

export const weekDays = (anchor) => {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/**
 * Six weeks starting on the Monday on or before the 1st.
 *
 * Always six rows, never five: a grid that changes height as the user pages
 * through months makes the whole screen jump.
 */
export const monthGrid = (anchor) => {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** "2026-09-13" for a date input, in local time rather than UTC. */
export const toDateInput = (date) => {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export const toTimeInput = (date) => {
  const d = new Date(date)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Turns the two inputs back into an instant, read in the browser's zone. */
export function fromDateTimeInput(dateValue, timeValue) {
  const [y, m, d] = dateValue.split('-').map(Number)
  const [hh, mm] = timeValue.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

/** Applies a HH:MM time to a day, keeping the day. */
export const atTime = (day, time) => fromDateTimeInput(toDateInput(day), time)

/** Moves an instant to another day, keeping its time of day. */
export function moveToDay(instant, day) {
  const from = new Date(instant)
  const to = startOfDay(day)
  to.setHours(from.getHours(), from.getMinutes(), 0, 0)
  return to
}

/** The browser's own zone, e.g. "Europe/Vienna". */
export const browserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return null
  }
}
