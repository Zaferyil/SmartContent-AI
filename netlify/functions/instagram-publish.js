import { json, CORS } from '../lib/instagram.js'
import { startPublish } from '../lib/publish.js'
import { requireAuth } from '../lib/auth.js'
import { resolveAccount } from '../lib/accounts.js'
import { recordPublished } from '../lib/posts.js'

/**
 * Publishes one post, now.
 *
 * Named for Instagram because that is all it could do when it was written; it
 * now serves any connected platform and routes on the channel's own, so a
 * Facebook Page and an Instagram account are the same request from the browser.
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
    const { id, token, userId, account } = await resolveAccount(accountId)
    const platform = account.platform ?? 'instagram'

    const started = await startPublish({
      platform,
      post: { imageUrl, imageUrls, videoUrl, caption, postType },
      ctx: { token, userId },
    })

    if (started.done) {
      // Recorded here rather than in the browser: a closed tab must not cost us
      // the history the analytics screens are built on.
      // A carousel has no single image; the first one is what the reports show.
      const thumbnail = imageUrl ?? imageUrls?.[0] ?? null
      await recordPublished({
        mediaId: started.mediaId,
        accountId: id,
        imageUrl: thumbnail,
        videoUrl: videoUrl ?? null,
        caption,
        postType,
      }).catch((e) => console.error('Could not record the published post:', e.message))

      return json(200, {
        ok: true,
        done: true,
        postType,
        mediaId: started.mediaId,
        containerId: started.containerId,
        accountId: id,
      })
    }

    return json(202, {
      ok: true,
      done: false,
      postType,
      containerId: started.containerId,
      imageUrl: imageUrl ?? imageUrls?.[0] ?? null,
      caption,
      accountId: id,
    })
  } catch (error) {
    console.error('Publish failed:', error.message)
    return json(error.statusCode || 500, {
      ok: false,
      error: error.message,
      metaCode: error.metaCode ?? null,
      metaSubcode: error.metaSubcode ?? null,
    })
  }
}
