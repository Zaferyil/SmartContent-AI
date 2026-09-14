import { json, CORS } from '../lib/instagram.js'
import { deleteScheduled, orphanedVideos } from '../lib/schedule.js'
import { requireAuth } from '../lib/auth.js'
import { deleteVideoByUrl } from '../lib/r2.js'

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
    requireAuth(event)

    let body
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return json(400, { error: 'Request body is not valid JSON' })
    }

    const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : null
    if (!ids || ids.length === 0) return json(400, { error: 'Provide ids to delete' })

    const { items, removed } = await deleteScheduled(ids)

    // A planned reel that is called off leaves its video behind and nothing
    // will ever come back for it. Only the ones no remaining post still points
    // at — one video can be planned to two channels. Tidying up must never be
    // able to fail the delete the user actually asked for.
    for (const url of orphanedVideos(removed, items)) {
      await deleteVideoByUrl(url).catch((e) =>
        console.error('Could not remove a cancelled reel from storage:', e.message)
      )
    }

    return json(200, { ok: true, items })
  } catch (error) {
    console.error('Could not delete from the schedule:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
