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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

/**
 * Waits for a media container to finish processing.
 *
 * Images normally report FINISHED on the very first check, so the first poll
 * happens with no delay. Video and reels can take far longer than a synchronous
 * Netlify function is allowed to run (10s on the free plan), which is why the
 * budget here is deliberately small — long media belongs in a `-background`
 * function, where the cap is 15 minutes.
 */
export async function waitForContainer(containerId, token, { attempts = 5, delayMs = 1500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))

    const { status_code: status } = await graph(containerId, {
      params: { fields: 'status_code' },
      token,
    })

    if (status === 'FINISHED') return
    if (status === 'ERROR' || status === 'EXPIRED') {
      const error = new Error(`Media processing failed with status ${status}`)
      error.statusCode = 502
      throw error
    }
  }

  const error = new Error(
    'Media was still processing when the function ran out of time. ' +
      'Video and reels need a background function.'
  )
  error.statusCode = 504
  throw error
}
