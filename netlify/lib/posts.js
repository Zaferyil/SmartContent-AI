import { randomUUID } from 'node:crypto'
import { readPosts, updatePosts } from './store.js'

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
 * @property {string}  postType     FEED | STORY
 * @property {string}  imageUrl     the R2 URL Instagram fetched
 * @property {string}  caption
 * @property {string}  publishedAt  ISO 8601, UTC
 * @property {?object} metrics      null until first fetched
 */

export async function listPosts() {
  const { posts } = await readPosts()
  // Newest first: every screen shows recent work at the top.
  return [...posts].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}

/** Records a post that Instagram has accepted. Ignores a mediaId already stored. */
export async function recordPublished({ mediaId, permalink, imageUrl, caption, postType }) {
  let created = null

  await updatePosts((posts) => {
    // The publish flow can report the same media twice (a retried finish call),
    // and a duplicate would double-count in every metric below.
    if (posts.some((p) => p.mediaId === mediaId)) return null

    created = {
      id: randomUUID(),
      mediaId: String(mediaId),
      permalink: permalink ?? null,
      platform: 'instagram',
      postType: postType ?? 'FEED',
      imageUrl: imageUrl ?? null,
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

  return updatePosts((posts) =>
    posts.map((post) => {
      const metrics = byMediaId[post.mediaId]
      return metrics ? { ...post, metrics: { ...metrics, fetchedAt } } : post
    })
  )
}
