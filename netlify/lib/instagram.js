/**
 * Shared helpers for the Instagram Graph API.
 *
 * Credentials are read from environment variables only — never from the request
 * body — so a browser can never supply (or leak) the access token.
 *
 * Two login routes exist and they use different hosts:
 *   - Instagram Login  -> graph.instagram.com   (no Facebook Page needed)
 *   - Facebook Login   -> graph.facebook.com    (Page required)
 * Set IG_LOGIN_MODE=facebook to use the second.
 */

const API_VERSION = process.env.IG_API_VERSION || 'v23.0'

const HOST =
  process.env.IG_LOGIN_MODE === 'facebook'
    ? 'https://graph.facebook.com'
    : 'https://graph.instagram.com'

export const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // Every GET here reports state that changes under the browser — the calendar
  // after a save, a job while it is still running. Without this the browser is
  // free to answer from cache and show work that already happened as missing.
  'Cache-Control': 'no-store',
}

export function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) }
}

/** Throws if the function is deployed without credentials configured. */
export function requireCredentials() {
  const token = process.env.IG_ACCESS_TOKEN
  const userId = process.env.IG_USER_ID

  if (!token || !userId) {
    const missing = [!token && 'IG_ACCESS_TOKEN', !userId && 'IG_USER_ID'].filter(Boolean)
    const error = new Error(`Missing environment variables: ${missing.join(', ')}`)
    error.statusCode = 500
    throw error
  }
  return { token, userId }
}

/**
 * Calls the Graph API and turns Meta's error envelope into a real Error.
 * Meta replies 200 with an `error` object in some cases, so check both.
 */
export async function graph(path, { method = 'GET', params = {}, token } = {}) {
  const url = new URL(`${HOST}/${API_VERSION}/${path}`)
  const payload = { ...params, access_token: token }

  let response
  if (method === 'GET') {
    Object.entries(payload).forEach(([k, v]) => url.searchParams.set(k, v))
    response = await fetch(url)
  } else {
    response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload),
    })
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.error) {
    const meta = data.error || {}
    const error = new Error(meta.message || `Instagram API error (HTTP ${response.status})`)
    error.statusCode = response.status === 200 ? 502 : response.status
    error.metaCode = meta.code
    error.metaSubcode = meta.error_subcode
    error.metaType = meta.type
    throw error
  }

  return data
}

const MAX_CAPTION = 2200

/**
 * What each post type needs from the Graph API.
 *
 * `media_type` is omitted for a feed image — that is the endpoint's default and
 * sending "IMAGE" is rejected. Stories carry no caption: Instagram ignores the
 * field, so sending one would only mislead the caller.
 */
export const POST_TYPES = {
  FEED: { mediaType: null, needsVideo: false, caption: true },
  STORY: { mediaType: 'STORIES', needsVideo: false, caption: false },
  REELS: { mediaType: 'REELS', needsVideo: true, caption: true },
  VIDEO: { mediaType: 'VIDEO', needsVideo: true, caption: true },
}

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 })

/**
 * First half of the two-step publish: hands Instagram the media to fetch.
 *
 * Shared by the browser-driven publish and the cron, so the two cannot drift
 * on which post type needs which field — a mismatch there is rejected by Meta
 * with a message that explains nothing.
 *
 * @returns {Promise<string>} the container id
 */
export async function createContainer({ imageUrl, videoUrl, caption = '', postType }, ctx) {
  const spec = POST_TYPES[postType]
  if (!spec) {
    throw badRequest(
      `Unknown postType "${postType}". Use one of: ${Object.keys(POST_TYPES).join(', ')}`
    )
  }

  const mediaUrl = spec.needsVideo ? videoUrl : imageUrl
  if (!mediaUrl) {
    throw badRequest(spec.needsVideo ? `${postType} needs a videoUrl` : `${postType} needs an imageUrl`)
  }
  // Instagram fetches this itself, so localhost and auth-gated URLs cannot work.
  if (!/^https:\/\//i.test(mediaUrl)) {
    throw badRequest('Media URL must be publicly reachable over HTTPS')
  }
  if (spec.caption && caption.length > MAX_CAPTION) {
    throw badRequest(`Caption exceeds the ${MAX_CAPTION} character limit`)
  }

  const params = spec.needsVideo ? { video_url: videoUrl } : { image_url: imageUrl }
  if (spec.mediaType) params.media_type = spec.mediaType
  if (spec.caption) params.caption = caption

  const container = await graph(`${ctx.userId}/media`, { method: 'POST', params, token: ctx.token })
  return container.id
}

/**
 * Waits for a media container to finish processing.
 *
 * Images normally report FINISHED on the very first check, so the first poll
 * happens with no delay. Video and reels can take far longer than a synchronous
 * Netlify function is allowed to run (10s on the free plan), so nothing here
 * ever waits in a loop — the caller polls instead.
 *
 * @returns true when the container is ready to publish, false while it is still
 *          processing. Throws if Instagram gave up on the media.
 */
export async function isContainerReady(containerId, token) {
  const { status_code: status } = await graph(containerId, {
    params: { fields: 'status_code' },
    token,
  })

  if (status === 'FINISHED') return true
  if (status === 'ERROR' || status === 'EXPIRED') {
    const error = new Error(`Media processing failed with status ${status}`)
    error.statusCode = 502
    throw error
  }
  return false
}

/** Second half of the two-step publish: turns a finished container into a post. */
export async function publishContainer(containerId, userId, token) {
  const published = await graph(`${userId}/media_publish`, {
    method: 'POST',
    params: { creation_id: containerId },
    token,
  })
  return published.id
}
