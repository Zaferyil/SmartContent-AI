/**
 * The one way this app talks to its own functions.
 *
 * Every call carries the shared password, and a rejected one clears the stored
 * password and hands control back to the app so it can ask again. Going through
 * a single place is what makes that true of every screen at once — a call that
 * forgot the header would simply fail, and a screen that handled 401 its own
 * way would leave the user stuck on a page that quietly stopped working.
 */

const PASSWORD_KEY = 'smartcontentai_password'
const HEADER = 'X-App-Password'

/** localStorage throws in private mode, and a missing password is recoverable. */
export function getPassword() {
  try {
    return localStorage.getItem(PASSWORD_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setPassword(value) {
  try {
    localStorage.setItem(PASSWORD_KEY, value)
  } catch {
    // Not fatal: the session keeps working, it just will not be remembered.
  }
}

export function clearPassword() {
  try {
    localStorage.removeItem(PASSWORD_KEY)
  } catch {
    /* nothing to clear */
  }
}

let onUnauthorized = null

/** The app registers a callback here to show the password screen again. */
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn
}

const unauthorized = () => Object.assign(new Error('unauthorized'), { code: 'unauthorized' })

/**
 * Calls one of our functions.
 *
 * @param path   the function name, e.g. 'schedule-list'
 * @param body   present means POST with JSON
 * @returns the parsed body, or null for the empty 202 a background function sends
 */
export async function api(path, { method, body, query } = {}) {
  const headers = {}

  const password = getPassword()
  if (password) headers[HEADER] = password
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const search = query ? `?${new URLSearchParams(query)}` : ''

  const response = await fetch(`/.netlify/functions/${path}${search}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401) {
    clearPassword()
    onUnauthorized?.()
    throw unauthorized()
  }

  // A background function answers 202 with an empty body.
  if (response.status === 202 && !response.headers.get('content-length')) return null

  const data = await response.json().catch(() => ({}))

  if (!response.ok && response.status !== 202) {
    throw new Error(data.error || `Request failed (HTTP ${response.status})`)
  }

  return data
}

/** True when the error came from a rejected password rather than the request. */
export const isUnauthorized = (error) => error?.code === 'unauthorized'
