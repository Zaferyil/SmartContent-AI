import { json, CORS, requireCredentials, graph } from '../lib/instagram.js'
import { listPosts, saveMetrics } from '../lib/posts.js'

// Graph API v22 removed `impressions` and `video_views`; `views` replaces both.
// Asking for a removed metric fails the whole request, so this list matters.
const FEED_METRICS = ['views', 'reach', 'likes', 'comments', 'saved', 'shares']

// A story's insights only exist while it is live, and the metric set differs.
const STORY_METRICS = ['views', 'reach', 'replies']

// Instagram allows 200 calls/hour per account. Refreshing every post every time
// would burn that on a few hundred posts, and old posts barely move anyway.
const MAX_PER_RUN = 40

async function fetchMetrics(post, token) {
  const metrics = post.postType === 'STORY' ? STORY_METRICS : FEED_METRICS

  const result = await graph(`${post.mediaId}/insights`, {
    params: { metric: metrics.join(',') },
    token,
  })

  // Meta returns [{ name, values: [{ value }] }]; flatten to { name: value }.
  return Object.fromEntries(
    (result.data ?? []).map((entry) => [entry.name, entry.values?.[0]?.value ?? 0])
  )
}

/**
 * Pulls fresh insight numbers for recorded posts and stores them.
 *
 * Safe to call repeatedly — it refreshes the most recent posts first and skips
 * the rest, so one run never exhausts the API quota.
 *
 * POST -> { ok: true, refreshed, failed }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const { token } = requireCredentials()
    const posts = (await listPosts()).slice(0, MAX_PER_RUN)

    if (posts.length === 0) return json(200, { ok: true, refreshed: 0, failed: 0 })

    const byMediaId = {}
    const failures = []

    // Sequential on purpose: parallel requests here trip Meta's rate limiter,
    // and this runs in the background where latency does not matter.
    for (const post of posts) {
      try {
        byMediaId[post.mediaId] = await fetchMetrics(post, token)
      } catch (error) {
        // An expired story has no insights left — expected, not a failure worth
        // stopping for.
        failures.push({ mediaId: post.mediaId, error: error.message })
      }
    }

    if (Object.keys(byMediaId).length > 0) await saveMetrics(byMediaId)

    return json(200, {
      ok: true,
      refreshed: Object.keys(byMediaId).length,
      failed: failures.length,
      failures: failures.slice(0, 5),
    })
  } catch (error) {
    console.error('Could not refresh metrics:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
