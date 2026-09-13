/**
 * Turns measured performance into publishing times.
 *
 * The honesty rule this file exists to enforce: a time is only ever presented
 * as learned from performance when it actually was. The same sample-size gate
 * the report screen uses decides that, and when it does not pass this falls
 * back to the times the user set themselves and says so — `source` is what the
 * UI must label, never a guess dressed up as a measurement.
 */

// Extensions spelled out so these modules also run unchanged under plain Node,
// which is what the scheduling tests execute them with.
import { buildBands, isMeasured, recommendBand, MIN_POSTS_FOR_ADVICE } from './postAnalytics.js'
import { addDays, atTime, startOfDay } from './calendar.js'

export const STRATEGIES = ['engagement', 'even', 'preferred']
export const GOALS = ['engagement', 'reach', 'consistency']

const toHHMM = (minutes) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(
    Math.round(minutes % 60)
  ).padStart(2, '0')}`

const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * The times to publish at, and where they came from.
 *
 * When the gate passes, a band's time is the median of when its own posts
 * actually went out — a real clock time from the history, not the midpoint of
 * an arbitrary four-hour window.
 *
 * @returns {{source: 'measured'|'preferred', times: string[], missing: number,
 *            band: ?object, sampleSize: number}}
 */
export function recommendedTimes({ posts = [], settings }) {
  const preferred = settings?.preferredTimes?.length ? settings.preferredTimes : ['09:00']
  const measured = posts.filter(isMeasured)
  const bands = buildBands(posts)
  const advice = recommendBand(bands, measured.length)

  const fallback = {
    source: 'preferred',
    times: preferred,
    missing: Math.max(0, MIN_POSTS_FOR_ADVICE - measured.length),
    band: null,
    sampleSize: measured.length,
  }

  if (!advice.ready) return fallback

  // Rank every band that carries enough posts, best reach first, then read each
  // one's own median publishing time out of the history.
  const ranked = bands
    .filter((band) => band.posts >= 4 && band.avgReach > 0)
    .sort((a, b) => b.avgReach - a.avgReach)

  const times = ranked
    .map((band) => {
      const minutes = measured
        .filter((post) => {
          const hour = new Date(post.publishedAt).getHours()
          return hour >= band.from && hour < band.to
        })
        .map((post) => {
          const d = new Date(post.publishedAt)
          return d.getHours() * 60 + d.getMinutes()
        })

      return minutes.length ? toHHMM(median(minutes)) : null
    })
    .filter(Boolean)

  if (times.length === 0) return fallback

  return {
    source: 'measured',
    times,
    missing: 0,
    band: advice.band,
    sampleSize: measured.length,
  }
}

/**
 * Lays `count` slots across a period.
 *
 * Never returns a slot in the past: a calendar entry the publisher would fire
 * the moment it is saved is not a plan, it is a surprise.
 *
 * @returns {Date[]} sorted, at most `count` long — shorter if the period ran out
 */
export function planSlots({ from, to, count, strategy, recommended, preferredTimes }) {
  const times =
    strategy === 'preferred'
      ? preferredTimes
      : strategy === 'engagement'
        ? recommended
        : preferredTimes

  if (!times?.length || count < 1) return []

  const firstDay = startOfDay(from)
  const lastDay = startOfDay(to)
  const days = Math.floor((lastDay - firstDay) / 86400000) + 1
  if (days < 1) return []

  const slots = []
  const now = Date.now()

  if (strategy === 'even') {
    // One post per step, steps spread so the last one lands on the final day.
    const step = count > 1 ? (days - 1) / (count - 1) : 0
    for (let i = 0; i < count; i++) {
      const day = addDays(firstDay, Math.round(i * step))
      slots.push(atTime(day, times[i % times.length]))
    }
  } else {
    // Fill day by day, cycling the times, until the count or the period runs out.
    outer: for (let d = 0; d < days; d++) {
      const day = addDays(firstDay, d)
      for (const time of times) {
        if (slots.length >= count) break outer
        slots.push(atTime(day, time))
      }
    }
  }

  return slots
    .filter((slot) => slot.getTime() > now)
    .sort((a, b) => a - b)
    .slice(0, count)
}
