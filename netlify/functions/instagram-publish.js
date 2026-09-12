import {
  json,
  CORS,
  requireCredentials,
  graph,
  isContainerReady,
  publishContainer,
} from '../lib/instagram.js'

const MAX_CAPTION = 2200

/**
 * What each post type needs from the Graph API.
 *
 * `media_type` is omitted for a feed image — that is the endpoint's default and
 * sending "IMAGE" is rejected. Stories carry no caption: Instagram ignores the
 * field, so sending one would only mislead the caller.
 */
const POST_TYPES = {
  FEED: { mediaType: null, needsVideo: false, caption: true },
  STORY: { mediaType: 'STORIES', needsVideo: false, caption: false },
  REELS: { mediaType: 'REELS', needsVideo: true, caption: true },
  VIDEO: { mediaType: 'VIDEO', needsVideo: true, caption: true },
}

/**
 * Publishes one post to Instagram.
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

    const spec = POST_TYPES[postType]
    if (!spec) {
      return json(400, {
        error: `Unknown postType "${postType}". Use one of: ${Object.keys(POST_TYPES).join(', ')}`,
      })
    }

    const mediaUrl = spec.needsVideo ? videoUrl : imageUrl
    if (!mediaUrl) {
      return json(400, {
        error: spec.needsVideo ? `${postType} needs a videoUrl` : `${postType} needs an imageUrl`,
      })
    }
    if (!/^https:\/\//i.test(mediaUrl)) {
      return json(400, { error: 'Media URL must be publicly reachable over HTTPS' })
    }
    if (spec.caption && caption.length > MAX_CAPTION) {
      return json(400, { error: `Caption exceeds the ${MAX_CAPTION} character limit` })
    }

    // Step 1 — create the media container.
    const params = spec.needsVideo ? { video_url: videoUrl } : { image_url: imageUrl }
    if (spec.mediaType) params.media_type = spec.mediaType
    if (spec.caption) params.caption = caption

    const container = await graph(`${userId}/media`, { method: 'POST', params, token })

    // Step 2 — one status check, never a wait loop. An image is normally ready
    // straight away, so the common case finishes in this single request; when it
    // is not, the caller polls instagram-publish-finish instead of this function
    // sitting on the clock until Netlify cuts it off at 10s.
    if (await isContainerReady(container.id, token)) {
      const mediaId = await publishContainer(container.id, userId, token)
      return json(200, { ok: true, done: true, postType, mediaId, containerId: container.id })
    }

    return json(202, { ok: true, done: false, postType, containerId: container.id })
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
