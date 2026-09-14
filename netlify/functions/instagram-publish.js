import {
  json,
  CORS,
  createContainer,
  isContainerReady,
  publishContainer,
} from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { resolveAccount } from '../lib/accounts.js'
import { recordPublished } from '../lib/posts.js'

/**
 * Publishes one post to Instagram, now.
 *
 * POST body:
 *   { "accountId": "...", "imageUrl": "https://...", "caption": "...", "postType": "FEED" }
 *   { "accountId": "...", "imageUrl": "https://...", "postType": "STORY" }
 *
 * `accountId` picks which connected account to act as; omitting it uses the
 * first Instagram account, which is what a single-account setup looks like.
 *
 * The media URL must be publicly reachable — Instagram fetches it server-side,
 * so localhost, signed-but-expiring, and auth-gated URLs all fail.
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

    const { imageUrl, imageUrls, videoUrl, caption = '', postType = 'FEED', accountId } = body
    const { id, token, userId } = await resolveAccount(accountId)

    // Step 1 — create the media container. For a carousel this is several
    // child containers and a parent, which createContainer handles.
    const containerId = await createContainer(
      { imageUrl, imageUrls, videoUrl, caption, postType },
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
      // A carousel has no single image; the first one is what the reports show.
      const thumbnail = imageUrl ?? imageUrls?.[0] ?? null
      await recordPublished({
        mediaId,
        accountId: id,
        imageUrl: thumbnail,
        videoUrl: videoUrl ?? null,
        caption,
        postType,
      }).catch((e) => console.error('Could not record the published post:', e.message))
      return json(200, { ok: true, done: true, postType, mediaId, containerId, accountId: id })
    }

    return json(202, {
      ok: true,
      done: false,
      postType,
      containerId,
      imageUrl: imageUrl ?? imageUrls?.[0] ?? null,
      caption,
      accountId: id,
    })
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
