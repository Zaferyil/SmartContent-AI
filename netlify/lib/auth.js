import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Who is allowed to call these functions.
 *
 * Netlify functions are public URLs. CORS only tells a *browser* which origins
 * may read a response; it stops nothing that speaks HTTP directly, so without a
 * check here anyone who learns the site address can publish to the connected
 * Instagram accounts — and, now that account tokens are stored server-side,
 * could try to make the app act as any of them.
 *
 * One shared password is the right size for a tool with a single operator. It
 * is not multi-user auth and does not pretend to be: everyone who knows it has
 * the same full access.
 */

import { isDeployed } from './runtime.js'

export const PASSWORD_HEADER = 'x-app-password'

// Hashing first means both sides are always 32 bytes, so the comparison cannot
// leak the password's length and timingSafeEqual cannot throw on a mismatch.
const digest = (value) => createHash('sha256').update(String(value ?? '')).digest()

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode })

/**
 * Throws unless the request carries the shared password.
 *
 * Fails closed: a deployed site with no APP_PASSWORD configured refuses every
 * request rather than serving an open one. An unprotected deployment is the
 * outcome worth preventing, and a site that plainly refuses is easier to
 * notice — and to fix — than one quietly answering to strangers.
 */
export function requireAuth(event) {
  const expected = process.env.APP_PASSWORD

  if (!expected) {
    if (isDeployed()) {
      throw fail(
        500,
        'APP_PASSWORD is not set. Add it under Site configuration → Environment variables, then redeploy.'
      )
    }
    return // Local development: nothing is exposed, so nothing to protect.
  }

  const headers = event?.headers ?? {}
  const supplied = headers[PASSWORD_HEADER] ?? headers[PASSWORD_HEADER.toUpperCase()] ?? ''

  if (!timingSafeEqual(digest(supplied), digest(expected))) {
    throw fail(401, 'Wrong password')
  }
}

/** True when this deployment has a password configured at all. */
export const isProtected = () => Boolean(process.env.APP_PASSWORD)
