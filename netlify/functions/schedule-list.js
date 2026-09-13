import { json, CORS } from '../lib/instagram.js'
import { listScheduled, PUBLISHABLE_PLATFORMS } from '../lib/schedule.js'
import { readSettings } from '../lib/settings.js'
import { requireAuth } from '../lib/auth.js'
import { isDeployed } from '../lib/runtime.js'

/**
 * Everything the calendar screen needs in one request.
 *
 * `publishable` is sent rather than assumed by the browser: whether a channel
 * can actually be posted to depends on server-side credentials the browser
 * cannot see, and a calendar that offers to schedule something nothing will
 * publish is worse than one that says so up front.
 *
 * GET -> { ok, items, settings, publishable, cronConfigured }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  try {
    requireAuth(event)

    const [items, settings] = await Promise.all([listScheduled(), readSettings()])

    return json(200, {
      ok: true,
      items,
      settings,
      publishable: PUBLISHABLE_PLATFORMS,
      // The cron only exists on a deployed site. Locally nothing publishes on
      // its own, and the screen has to say so instead of implying otherwise.
      cronConfigured: isDeployed(),
    })
  } catch (error) {
    console.error('Could not list the schedule:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
