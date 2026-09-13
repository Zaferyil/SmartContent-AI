import { json, CORS } from '../lib/instagram.js'
import { saveScheduled } from '../lib/schedule.js'

/**
 * Creates or updates scheduled posts.
 *
 * Takes a list so AI planning, which lays down several slots at once, is one
 * write rather than N racing ones against the same document.
 *
 * POST { "items": [{ id?, platform, postType, imageUrl, caption, scheduledFor, status }] }
 *   -> 200 { ok: true, items: [...] }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    let body
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return json(400, { error: 'Request body is not valid JSON' })
    }

    const items = Array.isArray(body.items) ? body.items : body.item ? [body.item] : null
    if (!items || items.length === 0) return json(400, { error: 'Provide items to save' })

    return json(200, { ok: true, items: await saveScheduled(items) })
  } catch (error) {
    console.error('Could not save the schedule:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
