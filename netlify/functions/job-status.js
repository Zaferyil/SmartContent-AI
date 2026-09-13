import { json, CORS } from '../lib/instagram.js'
import { getJob } from '../lib/jobs.js'
import { requireAuth } from '../lib/auth.js'

/**
 * Where a background job's result is collected.
 *
 * GET ?id=... -> { ok, status: running|done|failed, result?, error? }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  const id = event.queryStringParameters?.id
  if (!id) return json(400, { error: 'Provide an id' })

  try {
    requireAuth(event)

    const job = await getJob(id)
    // A job is pruned an hour after it finishes; by then the browser has long
    // since collected the result, so treat a miss as gone rather than an error.
    if (!job) return json(404, { ok: false, error: 'No such job — it may have expired' })

    return json(200, {
      ok: true,
      status: job.status,
      result: job.result,
      error: job.error,
    })
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
