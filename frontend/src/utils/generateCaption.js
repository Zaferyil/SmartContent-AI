import { api } from './api'

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 180000

/**
 * Asks Claude to write the copy from the post's own image.
 *
 * Writing measured 17s against a real image, so the work runs in a background
 * function rather than a request — a synchronous Netlify function is killed at
 * 10s on the free plan. Those reply with an empty 202 and cannot return an id,
 * so a job id is reserved first and the result collected by polling.
 *
 * @param onProgress called with the attempt count while waiting.
 */
export async function generateCaption(params, { onProgress } = {}) {
  const { jobId } = await api('job-start', { body: { type: 'caption' } })

  await api('generate-caption-background', { body: { ...params, jobId } })

  const deadline = Date.now() + POLL_TIMEOUT_MS
  let attempt = 0

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    attempt += 1
    onProgress?.(attempt)

    const job = await api('job-status', { query: { id: jobId } })

    if (job.status === 'failed') throw new Error(job.error || 'Writing the copy failed')
    if (job.status === 'done') return job.result.caption
  }

  throw new Error('Writing the copy is taking unusually long — try again')
}
