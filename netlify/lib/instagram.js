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
  'Access-Control-Allow-Headers': 'Content-Type, X-App-Password',
  // Every GET here reports state that changes under the browser — the calendar
  // after a save, a job while it is still running. Without this the browser is
  // free to answer from cache and show work that already happened as missing.
  'Cache-Control': 'no-store',
}

export function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) }
}

/** The environment credentials, when this deployment still has them. */
export function envCredentials() {
  const token = process.env.IG_ACCESS_TOKEN
  const userId = process.env.IG_USER_ID
  return token && userId ? { token, userId } : null
}

/**
 * Calls the Graph API and turns Meta's error envelope into a real Error.
 * Meta replies 200 with an `error` object in some cases, so check both.
 */
export async function graph(path, { method = 'GET', params = {}, token, versioned = true } = {}) {
  // Token exchange endpoints sit at the host root, not under a version — asking
  // for /v23.0/refresh_access_token is a 400 that explains nothing.
  const url = new URL(versioned ? `${HOST}/${API_VERSION}/${path}` : `${HOST}/${path}`)
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
  CAROUSEL: { mediaType: 'CAROUSEL', needsVideo: false, caption: true, many: true },
  REELS: { mediaType: 'REELS', needsVideo: true, caption: true },
  VIDEO: { mediaType: 'VIDEO', needsVideo: true, caption: true },
}

/** Meta's ceiling. A carousel of one is a feed post, so two is our floor. */
export const MAX_CAROUSEL = 10
export const MIN_CAROUSEL = 2

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 })

const requireHttps = (url) => {
  // Instagram fetches this itself, so localhost and auth-gated URLs cannot work.
  if (!/^https:\/\//i.test(url ?? '')) throw badRequest('Media URL must be publicly reachable over HTTPS')
}

/**
 * A carousel, which is three rounds of work rather than one.
 *
 * Each image becomes its own container marked `is_carousel_item`, and a parent
 * container ties them together in order. The children are created at once
 * rather than in sequence: ten of them one after another is ten round trips to
 * Meta, which on the browser-driven path would spend the whole function budget
 * before the parent is even asked for.
 *
 * @returns {Promise<string>} the parent container id
 */
async function createCarousel({ imageUrls, caption }, ctx) {
  if (!Array.isArray(imageUrls) || imageUrls.length < MIN_CAROUSEL) {
    throw badRequest(`A carousel needs at least ${MIN_CAROUSEL} images`)
  }
  if (imageUrls.length > MAX_CAROUSEL) {
    throw badRequest(`A carousel takes at most ${MAX_CAROUSEL} images`)
  }
  imageUrls.forEach(requireHttps)

  const children = await Promise.all(
    imageUrls.map((imageUrl) =>
      graph(`${ctx.userId}/media`, {
        method: 'POST',
        params: { image_url: imageUrl, is_carousel_item: true },
        token: ctx.token,
      })
    )
  )

  const parent = await graph(`${ctx.userId}/media`, {
    method: 'POST',
    params: {
      media_type: 'CAROUSEL',
      // Order matters: it is the order they are swiped through.
      children: children.map((child) => child.id).join(','),
      caption,
    },
    token: ctx.token,
  })

  return parent.id
}

/**
 * First half of the two-step publish: hands Instagram the media to fetch.
 *
 * Shared by the browser-driven publish and the cron, so the two cannot drift
 * on which post type needs which field — a mismatch there is rejected by Meta
 * with a message that explains nothing.
 *
 * @returns {Promise<string>} the container id
 */
export async function createContainer(
  { imageUrl, imageUrls, videoUrl, caption = '', postType },
  ctx
) {
  const spec = POST_TYPES[postType]
  if (!spec) {
    throw badRequest(
      `Unknown postType "${postType}". Use one of: ${Object.keys(POST_TYPES).join(', ')}`
    )
  }

  if (spec.caption && caption.length > MAX_CAPTION) {
    throw badRequest(`Caption exceeds the ${MAX_CAPTION} character limit`)
  }

  // Handled here rather than by the caller, so the cron and the browser cannot
  // drift on how a carousel is built.
  if (spec.many) return createCarousel({ imageUrls, caption }, ctx)

  const mediaUrl = spec.needsVideo ? videoUrl : imageUrl
  if (!mediaUrl) {
    throw badRequest(spec.needsVideo ? `${postType} needs a videoUrl` : `${postType} needs an imageUrl`)
  }
  requireHttps(mediaUrl)

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
  // `status` alongside `status_code`: the code says only that it failed, while
  // status carries Meta's sentence about why. For an image that is rarely
  // needed; for a reel it is the only clue there is — the video was fetched,
  // transcoded and rejected somewhere the user cannot see, and "ERROR" on its
  // own leaves them re-exporting at random.
  const container = await graph(containerId, {
    params: { fields: 'status_code,status' },
    token,
  })

  const code = container.status_code
  if (code === 'FINISHED') return true

  if (code === 'ERROR' || code === 'EXPIRED') {
    const detail = typeof container.status === 'string' ? container.status.trim() : ''
    const error = new Error(
      detail ? `Instagram rejected the media: ${detail}` : `Media processing failed with status ${code}`
    )
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
