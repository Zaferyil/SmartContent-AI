/**
 * Turns the recorded publishing history into the numbers the report screen shows.
 *
 * This runs in the browser on purpose: `publishedAt` is stored as a UTC instant,
 * and "the best time to post" only means anything in the audience's own clock.
 * `Date#getHours` gives exactly that, with no timezone configuration to get wrong.
 */

/** Hours per band. Six four-hour bands keep a small sample from fragmenting. */
export const BAND_HOURS = 4
export const BAND_COUNT = 24 / BAND_HOURS

/**
 * How much history a timing recommendation needs before it is worth anything.
 *
 * Below this the ranking is noise — three posts in a band can put 3am on top
 * because one of them happened to be good. The screen shows the measured table
 * either way and withholds only the advice, rather than inventing it.
 */
export const MIN_POSTS_FOR_ADVICE = 20
const MIN_IN_BAND = 4
const MIN_BANDS_COVERED = 3

/** Everything a viewer did with the post. Stories report `replies` instead. */
export const interactionsOf = (m) =>
  (m?.likes ?? 0) + (m?.comments ?? 0) + (m?.saved ?? 0) + (m?.shares ?? 0) + (m?.replies ?? 0)

/** A post Instagram has reported on. Others are published but not yet measured. */
export const isMeasured = (post) => Boolean(post?.metrics && post?.publishedAt)

export function summarise(posts) {
  const measured = posts.filter(isMeasured)

  const totals = measured.reduce(
    (acc, post) => {
      const m = post.metrics
      acc.views += m.views ?? 0
      acc.reach += m.reach ?? 0
      acc.likes += m.likes ?? 0
      acc.comments += m.comments ?? 0
      acc.interactions += interactionsOf(m)
      return acc
    },
    { views: 0, reach: 0, likes: 0, comments: 0, interactions: 0 }
  )

  return {
    ...totals,
    published: posts.length,
    measured: measured.length,
    // Interactions per person reached, summed before dividing: one post with a
    // reach of 3 must not swing the rate the way averaging per-post rates does.
    engagement: totals.reach > 0 ? (totals.interactions / totals.reach) * 100 : null,
  }
}

/** Groups measured posts into bands of the viewer's local day. */
export function buildBands(posts) {
  const bands = Array.from({ length: BAND_COUNT }, (_, index) => ({
    index,
    from: index * BAND_HOURS,
    to: index * BAND_HOURS + BAND_HOURS,
    posts: 0,
    reach: 0,
    interactions: 0,
  }))

  for (const post of posts.filter(isMeasured)) {
    const hour = new Date(post.publishedAt).getHours()
    const band = bands[Math.floor(hour / BAND_HOURS)]
    band.posts += 1
    band.reach += post.metrics.reach ?? 0
    band.interactions += interactionsOf(post.metrics)
  }

  return bands.map((band) => ({
    ...band,
    avgReach: band.posts > 0 ? band.reach / band.posts : 0,
    avgInteractions: band.posts > 0 ? band.interactions / band.posts : 0,
  }))
}

/**
 * Picks the band to recommend, or explains what is still missing.
 *
 * Timing moves reach — Instagram decides how far to push a post from how it
 * lands in its first hour — so reach per post is what the bands are ranked on.
 *
 * @returns {{ready: true, band: object, runnerUp: ?object}
 *          | {ready: false, reason: 'volume', missing: number}
 *          | {ready: false, reason: 'spread'}}
 */
export function recommendBand(bands, measuredCount) {
  if (measuredCount < MIN_POSTS_FOR_ADVICE) {
    return { ready: false, reason: 'volume', missing: MIN_POSTS_FOR_ADVICE - measuredCount }
  }

  // Enough posts, all at the same time of day, compares nothing.
  if (bands.filter((band) => band.posts >= 2).length < MIN_BANDS_COVERED) {
    return { ready: false, reason: 'spread' }
  }

  const ranked = bands
    .filter((band) => band.posts >= MIN_IN_BAND)
    .sort((a, b) => b.avgReach - a.avgReach)

  if (ranked.length < 2 || ranked[0].avgReach === 0) return { ready: false, reason: 'spread' }

  return { ready: true, band: ranked[0], runnerUp: ranked[1] }
}

/** "08:00 – 12:00" in the viewer's own clock. */
export const bandLabel = (band) =>
  `${String(band.from).padStart(2, '0')}:00 – ${String(band.to % 24).padStart(2, '0')}:00`
