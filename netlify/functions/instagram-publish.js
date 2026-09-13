import {
  json,
  CORS,
  requireCredentials,
  createContainer,
  isContainerReady,
  publishContainer,
} from '../lib/instagram.js'
import { recordPublished } from '../lib/posts.js'

/**
 * Publishes one post to Instagram, now.
 *
 * POST body:
 *   { "imageUrl": "https://...", "caption": "...", "postType": "FEED" }
 *   { "imageUrl": "https://...", "postType": "STORY" }
 *   { "videoUrl": "https://...", "caption": "...", "postType": "REELS" }
 *
 * The media URL must be publicly reachable — Instagram fetches it server-side,
 * so localhost, signed-but-expiring, and auth-gated URLs all fail.
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const { token, userId } = requireCredentials()

    let body
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return json(400, { error: 'Request body is not valid JSON' })
    }

    const { imageUrl, videoUrl, caption = '', postType = 'FEED' } = body

    // Step 1 — create the media container.
    const containerId = await createContainer(
      { imageUrl, videoUrl, caption, postType },
      { token, userId }
    )

    // Step 2 — one status check, never a wait loop. An image is normally ready
    // straight away, so the common case finishes in this single request; when it
    // is not, the caller polls instagram-publish-finish instead of this function
    // sitting on the clock until Netlify cuts it off at 10s.
    if (await isContainerReady(containerId, token)) {
      const mediaId = await publishContainer(containerId, userId, token)
      // Recorded here rather than in the browser: a closed tab must not cost us
      // the history the analytics screens are built on.
      await recordPublished({ mediaId, imageUrl, caption, postType }).catch((e) =>
        console.error('Could not record the published post:', e.message)
      )
      return json(200, { ok: true, done: true, postType, mediaId, containerId })
    }

    return json(202, { ok: true, done: false, postType, containerId, imageUrl, caption })
  } catch (error) {
    console.error('Instagram publish failed:', error.message)
    return json(error.statusCode || 500, {
      ok: false,
      error: error.message,
      metaCode: error.metaCode ?? null,
      metaSubcode: error.metaSubcode ?? null,
    })
  }
}
