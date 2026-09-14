import { randomUUID } from 'node:crypto'
import { readDoc, updateDoc } from './store.js'
import { MAX_CAROUSEL, MIN_CAROUSEL } from './instagram.js'

const KEY = 'schedule'

/**
 * A post waiting to go out.
 *
 * The calendar screen is a view of this list and nothing else, so a slot the
 * user can see here is a slot the publisher will actually act on.
 *
 * `scheduledFor` is an ISO instant. The user picks a wall-clock time in their
 * own zone and the browser converts, so an item means the same moment whether
 * it is read by the calendar, the queue, or the cron running in UTC.
 *
 * Status is the whole lifecycle, and each value means something the runner acts
 * on differently:
 *   draft       no content yet, or not released — the runner skips it
 *   scheduled   ready to go at scheduledFor
 *   publishing  a media container exists; the next run finishes it
 *   published   live, with mediaId
 *   failed      the API refused; `error` says why and the user can retry
 *
 * @typedef {object} ScheduledPost
 * @property {string}  id
 * @property {?string} accountId     which connected account publishes it; null
 *                                   falls back to the first on the platform
 * @property {string}  platform
 * @property {string}  postType      FEED | STORY
 * @property {?string} imageUrl
 * @property {string}  caption
 * @property {string}  scheduledFor  ISO 8601 instant
 * @property {string}  status
 * @property {?string} containerId   set once Instagram has accepted the media
 * @property {?string} mediaId       set once published
 * @property {?string} error         set when status is 'failed'
 * @property {number}  attempts
 */

export const STATUSES = ['draft', 'scheduled', 'publishing', 'published', 'failed']

export { MAX_CAROUSEL, MIN_CAROUSEL }

/** Only Instagram has server-side credentials, so only it can actually publish. */
export const PUBLISHABLE_PLATFORMS = ['instagram']

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 })

const byTime = (a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? '')

export async function listScheduled() {
  const { items } = await readDoc(KEY)
  return [...items].sort(byTime)
}

/** Validates and normalises one item coming from the browser. */
function normalise(input, existing = null) {
  const base = existing ?? {
    id: randomUUID(),
    accountId: null,
    platform: 'instagram',
    postType: 'FEED',
    imageUrl: null,
    // A carousel's images, in the order they are swiped through. Empty for
    // every other post type, which carries its one image in imageUrl.
    imageUrls: [],
    caption: '',
    scheduledFor: null,
    status: 'draft',
    containerId: null,
    mediaId: null,
    error: null,
    attempts: 0,
    createdAt: new Date().toISOString(),
  }

  const next = { ...base }

  if (input.accountId !== undefined) next.accountId = input.accountId || null
  if (input.platform !== undefined) next.platform = String(input.platform)
  if (input.postType !== undefined) next.postType = String(input.postType)
  if (input.caption !== undefined) next.caption = String(input.caption)
  if (input.imageUrl !== undefined) next.imageUrl = input.imageUrl || null
  if (input.imageUrls !== undefined) {
    next.imageUrls = Array.isArray(input.imageUrls) ? input.imageUrls.filter(Boolean) : []
  }
  // Records written before carousels existed have no imageUrls at all.
  if (!Array.isArray(next.imageUrls)) next.imageUrls = []

  if (input.scheduledFor !== undefined) {
    const when = new Date(input.scheduledFor)
    if (Number.isNaN(when.getTime())) throw badRequest('scheduledFor is not a valid date')
    next.scheduledFor = when.toISOString()
  }

  if (input.status !== undefined) {
    if (!STATUSES.includes(input.status)) {
      throw badRequest(`Unknown status "${input.status}". Use one of: ${STATUSES.join(', ')}`)
    }
    next.status = input.status
    // Re-arming after a failure must clear the old reason, or the drawer would
    // keep showing an error for a post that is queued again.
    if (input.status === 'scheduled') {
      next.error = null
      next.containerId = null
    }
  }

  if (next.status === 'scheduled') {
    if (!next.scheduledFor) throw badRequest('A scheduled post needs a scheduledFor time')
    if (!PUBLISHABLE_PLATFORMS.includes(next.platform)) {
      throw badRequest(`Publishing to "${next.platform}" is not connected yet`)
    }

    // Refused here rather than at publishing time: a carousel queued with one
    // image would sit looking fine until the cron picked it up hours later and
    // Meta rejected it.
    if (next.postType === 'CAROUSEL') {
      if (next.imageUrls.length < MIN_CAROUSEL) {
        throw badRequest(`A carousel needs at least ${MIN_CAROUSEL} images`)
      }
      if (next.imageUrls.length > MAX_CAROUSEL) {
        throw badRequest(`A carousel takes at most ${MAX_CAROUSEL} images`)
      }
    } else if (!next.imageUrl) {
      throw badRequest('A scheduled post needs an image')
    }
  }

  next.updatedAt = new Date().toISOString()
  return next
}

/** Creates or replaces items. Returns the saved records. */
export async function saveScheduled(inputs) {
  const saved = []

  await updateDoc(KEY, (items) => {
    const next = [...items]
    saved.length = 0

    for (const input of inputs) {
      const index = input.id ? next.findIndex((item) => item.id === input.id) : -1
      const record = normalise(input, index >= 0 ? next[index] : null)
      if (index >= 0) next[index] = record
      else next.push(record)
      saved.push(record)
    }

    return next
  })

  return saved
}

export async function deleteScheduled(ids) {
  const gone = new Set(ids)
  const next = await updateDoc(KEY, (items) => items.filter((item) => !gone.has(item.id)))
  return next
}

/**
 * What the publisher should act on right now.
 *
 * `publishing` items come first and ignore the clock: their media container is
 * already sitting on Instagram's side waiting to be published, and finishing
 * one costs a fraction of what starting a new one does.
 */
export function dueNow(items, now = Date.now()) {
  const inFlight = items.filter((item) => item.status === 'publishing')
  const ready = items
    .filter((item) => item.status === 'scheduled' && Date.parse(item.scheduledFor) <= now)
    .sort(byTime)

  return [...inFlight, ...ready]
}

/** Writes back the outcome of one publish attempt. */
export async function patchScheduled(id, patch) {
  await updateDoc(KEY, (items) =>
    items.map((item) =>
      item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
    )
  )
}
