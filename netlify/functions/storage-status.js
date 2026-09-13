import { json, CORS } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { storageDiagnostics } from '../lib/store.js'

/**
 * Answers one question: can this deploy actually store anything?
 *
 * Blobs failing is invisible from the outside — the app simply behaves as
 * though nothing was ever saved — so this reports the state directly instead
 * of leaving it to be inferred from an empty screen.
 *
 * It reports the *names* of the Netlify-provided variables that are present,
 * never any value, so it can be read out loud safely. Seeing other Netlify
 * variables but not NETLIFY_BLOBS_CONTEXT means the runtime is injecting
 * normally and Blobs specifically is not enabled for the site.
 *
 * GET -> { ok, mode, canRead, canWrite, ... }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  try {
    requireAuth(event)
    return json(200, { ok: true, ...(await storageDiagnostics()) })
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
