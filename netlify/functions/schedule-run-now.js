import { json, CORS } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { handler as run } from './schedule-run.js'

/**
 * Runs the publisher once, on demand.
 *
 * The same work the five-minute schedule does, behind the app password: for
 * finding out whether a post that should have gone out will, without waiting
 * for the clock — and for sending it when the schedule is not firing.
 *
 * POST -> { ok, checked, handled, results: [{ id, state, error? }] }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    requireAuth(event)
    return await run({ httpMethod: 'POST' })
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
