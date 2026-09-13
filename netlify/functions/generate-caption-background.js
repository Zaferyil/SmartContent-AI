import { finishJob, failJob } from '../lib/jobs.js'
import { writeCaption } from '../lib/caption.js'
import { requireAuth } from '../lib/auth.js'

/**
 * Writes the copy out of band.
 *
 * Measured at 17s against a real image — well past the 10s a synchronous
 * Netlify function gets on the free plan. A background function has 15 minutes
 * but replies with an empty 202, so the caller gets a job id (in a header,
 * since the body must stay empty) and polls job-status for the result.
 */
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' }

  // Checked on its own, so a rejected password is not reported as bad JSON.
  try {
    requireAuth(event)
  } catch (error) {
    return { statusCode: error.statusCode || 401, body: '' }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: '' }
  }

  // The id has to exist before any work starts, so the browser can poll for it
  // the moment this returns.
  const jobId = body.jobId
  if (!jobId) return { statusCode: 400, body: '' }

  try {
    const result = await writeCaption(body)
    await finishJob(jobId, result)
  } catch (error) {
    console.error('Caption job failed:', error.message)
    await failJob(jobId, error)
  }

  return { statusCode: 202, body: '' }
}
