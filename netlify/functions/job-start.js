import { json, CORS } from '../lib/instagram.js'
import { createJob } from '../lib/jobs.js'
import { requireAuth } from '../lib/auth.js'

/**
 * Reserves a job id.
 *
 * A background function answers with an empty 202 and cannot hand back an id,
 * so the browser asks for one here first and passes it along when it kicks the
 * work off.
 *
 * POST { "type": "caption" } -> { ok: true, jobId }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    requireAuth(event)

    const { type = 'caption' } = JSON.parse(event.body || '{}')
    const job = await createJob(type)
    return json(200, { ok: true, jobId: job.id })
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
