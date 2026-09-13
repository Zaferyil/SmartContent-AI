import { json, CORS, graph } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { resolveAccount } from '../lib/accounts.js'
import { listPosts, saveMetrics } from '../lib/posts.js'

// Graph API v22 removed `impressions` and `video_views`; `views` replaces both.
// Asking for a removed metric fails the whole request, so this list matters.
const FEED_METRICS = ['views', 'reach', 'likes', 'comments', 'saved', 'shares']

// A story's insights only exist while it is live, and the metric set differs.
const STORY_METRICS = ['views', 'reach', 'replies']

// Instagram allows 200 calls/hour per account. Refreshing every post every time
// would burn that on a few hundred posts, and old posts barely move anyway.
const MAX_PER_ACCOUNT = 40

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
 * Each post is read with the credentials of the account that published it, and
 * the per-run cap applies per account — Instagram's rate limit is per account
 * too, so one busy channel must not starve the others.
 *
 * Safe to call repeatedly — it refreshes the most recent posts first and skips
 * the rest, so one run never exhausts the quota.
 *
 * POST -> { ok: true, refreshed, failed }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    requireAuth(event)

    const posts = await listPosts()
    if (posts.length === 0) return json(200, { ok: true, refreshed: 0, failed: 0 })

    // Group by account, newest first within each — listPosts already sorts.
    const byAccount = new Map()
    for (const post of posts) {
      const key = post.accountId ?? '__default__'
      const bucket = byAccount.get(key) ?? []
      if (bucket.length < MAX_PER_ACCOUNT) bucket.push(post)
      byAccount.set(key, bucket)
    }

    const byMediaId = {}
    const failures = []

    for (const [accountKey, bucket] of byAccount) {
      let token
      try {
        ;({ token } = await resolveAccount(accountKey === '__default__' ? null : accountKey))
      } catch (error) {
        // A disconnected account is no reason to abandon the others.
        failures.push({ accountId: accountKey, error: error.message })
        continue
      }

      // Sequential on purpose: parallel requests here trip Meta's rate limiter,
      // and this runs in the background where latency does not matter.
      for (const post of bucket) {
        try {
          byMediaId[post.mediaId] = await fetchMetrics(post, token)
        } catch (error) {
          // An expired story has no insights left — expected, not a failure
          // worth stopping for.
          failures.push({ mediaId: post.mediaId, error: error.message })
        }
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
