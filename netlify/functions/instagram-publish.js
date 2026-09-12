import { json, CORS, requireCredentials, graph, waitForContainer } from './_instagram.js'

const MAX_CAPTION = 2200

/**
 * Publishes one post to Instagram.
 *
 * POST body:
 *   { "imageUrl": "https://...", "caption": "..." }              → feed image
 *   { "videoUrl": "https://...", "caption": "...", "type": "REELS" }
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

    const { imageUrl, videoUrl, caption = '', type } = body
    const mediaUrl = imageUrl || videoUrl

    if (!mediaUrl) {
      return json(400, { error: 'Provide either imageUrl or videoUrl' })
    }
    if (!/^https:\/\//i.test(mediaUrl)) {
      return json(400, { error: 'Media URL must be publicly reachable over HTTPS' })
    }
    if (caption.length > MAX_CAPTION) {
      return json(400, { error: `Caption exceeds the ${MAX_CAPTION} character limit` })
    }

    // Step 1 — create the media container.
    const params = { caption }
    if (videoUrl) {
      params.video_url = videoUrl
      params.media_type = type === 'REELS' ? 'REELS' : 'VIDEO'
    } else {
      params.image_url = imageUrl
    }

    const container = await graph(`${userId}/media`, { method: 'POST', params, token })

    // Step 2 — wait for processing, then publish.
    await waitForContainer(container.id, token)

    const published = await graph(`${userId}/media_publish`, {
      method: 'POST',
      params: { creation_id: container.id },
      token,
    })

    return json(200, {
      ok: true,
      mediaId: published.id,
      containerId: container.id,
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
