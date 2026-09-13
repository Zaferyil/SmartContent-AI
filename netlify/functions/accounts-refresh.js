import { json, CORS } from '../lib/instagram.js'
import { refreshDueTokens } from '../lib/accounts.js'

/**
 * Keeps connected accounts connected. Scheduled daily in netlify.toml.
 *
 * An Instagram token dies 60 days after it is issued, and Meta lets a valid one
 * be exchanged for a fresh 60 days with no user involved. Running that on a
 * schedule is the whole difference between connecting a channel once and
 * re-pasting a token for every account every two months — the kind of chore
 * that gets forgotten until posts have quietly stopped going out.
 *
 * Deliberately unauthenticated: Netlify invokes it, there is nothing to read
 * back, and it acts only on tokens already stored.
 */
export const handler = async (event) => {
  if (event?.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  try {
    const results = await refreshDueTokens()
    if (results.length > 0) console.log('Token refresh:', JSON.stringify(results))
    return json(200, { ok: true, checked: results.length, results })
  } catch (error) {
    console.error('Token refresh run failed:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
