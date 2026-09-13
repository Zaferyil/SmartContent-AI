import { json, CORS } from '../lib/instagram.js'
import { writeSettings } from '../lib/settings.js'

/**
 * Saves the publishing preferences.
 *
 * POST { timezone?, postsPerDay?, preferredTimes? } -> 200 { ok: true, settings }
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

    return json(200, { ok: true, settings: await writeSettings(body) })
  } catch (error) {
    console.error('Could not save settings:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
