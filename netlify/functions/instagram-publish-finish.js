import { json, CORS, isContainerReady, publishContainer } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { resolveAccount } from '../lib/accounts.js'
import { recordPublished } from '../lib/posts.js'

/**
 * Second half of the two-step publish.
 *
 * instagram-publish returns 202 with a containerId when Instagram is still
 * processing the media. The caller then polls here until `done` is true. Each
 * call does exactly one status check, so no request ever approaches Netlify's
 * 10s function limit however long the media takes.
 *
 * POST { "containerId": "1784...", "accountId": "..." }
 *   ->  202 { ok: true, done: false }   still processing, poll again
 *   ->  200 { ok: true, done: true, mediaId }  published
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    requireAuth(event)

    let body
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return json(400, { error: 'Request body is not valid JSON' })
    }

    const { containerId, imageUrl, caption, postType, accountId } = body
    if (!containerId) return json(400, { error: 'Provide a containerId' })

    // The container belongs to one account, so this half has to run as the same
    // one that created it.
    const { id, token, userId } = await resolveAccount(accountId)

    if (!(await isContainerReady(containerId, token))) {
      return json(202, { ok: true, done: false, containerId })
    }

    const mediaId = await publishContainer(containerId, userId, token)
    await recordPublished({ mediaId, accountId: id, imageUrl, caption, postType }).catch((e) =>
      console.error('Could not record the published post:', e.message)
    )
    return json(200, { ok: true, done: true, mediaId, containerId, accountId: id })
  } catch (error) {
    console.error('Instagram publish finish failed:', error.message)
    return json(error.statusCode || 500, {
      ok: false,
      error: error.message,
      metaCode: error.metaCode ?? null,
    })
  }
}
