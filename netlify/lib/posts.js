import { randomUUID } from 'node:crypto'
import { readDoc, updateDoc } from './store.js'

const KEY = 'posts'

/**
 * A published post as this app records it.
 *
 * `publishedAt` is what the hour-of-day analysis reads, so it is stored as an
 * ISO timestamp and never as a formatted local string.
 *
 * @typedef {object} Post
 * @property {string}  id           our id, stable across metric refreshes
 * @property {string}  mediaId      Instagram's id — the key for fetching insights
 * @property {string}  platform     'instagram' for now; the field exists so the
 *                                  other channels do not need a migration later
 * @property {?string} accountId    which connected account published it. Null on
 *                                  posts recorded before accounts existed; those
 *                                  resolve to the first account of the platform
 * @property {string}  postType     FEED | CAROUSEL | STORY | REELS
 * @property {?string} imageUrl     the R2 URL Instagram fetched. Null on a reel,
 *                                  which has no still to show
 * @property {?string} videoUrl     the R2 URL of a reel's video, null otherwise
 * @property {string}  caption
 * @property {string}  publishedAt  ISO 8601, UTC
 * @property {?object} metrics      null until first fetched
 */

export async function listPosts() {
  const { items: posts } = await readDoc(KEY)
  // Newest first: every screen shows recent work at the top.
  return [...posts].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}

/** Records a post that Instagram has accepted. Ignores a mediaId already stored. */
export async function recordPublished({
  mediaId,
  accountId = null,
  permalink,
  imageUrl,
  videoUrl,
  caption,
  postType,
}) {
  let created = null

  await updateDoc(KEY, (posts) => {
    // The publish flow can report the same media twice (a retried finish call),
    // and a duplicate would double-count in every metric below.
    if (posts.some((p) => p.mediaId === mediaId)) return null

    created = {
      id: randomUUID(),
      mediaId: String(mediaId),
      permalink: permalink ?? null,
      platform: 'instagram',
      accountId,
      postType: postType ?? 'FEED',
      imageUrl: imageUrl ?? null,
      videoUrl: videoUrl ?? null,
      caption: caption ?? '',
      publishedAt: new Date().toISOString(),
      metrics: null,
    }
    return [...posts, created]
  })

  return created
}

/** Merges freshly fetched metrics into the stored posts, matched by mediaId. */
export async function saveMetrics(byMediaId) {
  const fetchedAt = new Date().toISOString()

  return updateDoc(KEY, (posts) =>
    posts.map((post) => {
      const metrics = byMediaId[post.mediaId]
      return metrics ? { ...post, metrics: { ...metrics, fetchedAt } } : post
    })
  )
}
