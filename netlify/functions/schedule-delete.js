import { json, CORS } from '../lib/instagram.js'
import { deleteScheduled } from '../lib/schedule.js'

/**
 * Removes scheduled posts from the calendar.
 *
 * This only touches the plan. A post already published is on Instagram and
 * deleting its calendar entry does not take it down.
 *
 * POST { "ids": ["..."] } -> 200 { ok: true, items: [...] }
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

    const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : null
    if (!ids || ids.length === 0) return json(400, { error: 'Provide ids to delete' })

    return json(200, { ok: true, items: await deleteScheduled(ids) })
  } catch (error) {
    console.error('Could not delete from the schedule:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
