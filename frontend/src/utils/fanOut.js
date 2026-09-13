/**
 * Runs one task per channel and reports what happened to each of them.
 *
 * Publishing the same post to two channels has three outcomes, not two: both
 * worked, neither worked, or one did. The third is the one that matters. A
 * plain `Promise.all` collapses it into a failure and loses which channel had
 * already gone out — and "publishing failed" in front of a post that is live on
 * Instagram invites the user to press the button again and post it twice.
 *
 * So nothing here throws. Every channel gets a row, and the caller shows them.
 *
 * The tasks run one after another rather than at once: each Instagram publish
 * takes the better part of ten seconds and counts against a per-account posting
 * limit, and a burst is the shape most likely to trip it. For the handful of
 * channels one person manages, the wait is the safer trade.
 *
 * @param {Array} channels
 * @param {(channel: any) => Promise<any>} task
 * @returns {Promise<Array<{ channel, ok: boolean, value?: any, error?: string }>>}
 */
export async function fanOut(channels, task) {
  const results = []

  for (const channel of channels) {
    try {
      results.push({ channel, ok: true, value: await task(channel) })
    } catch (error) {
      results.push({ channel, ok: false, error: error.message })
    }
  }

  return results
}

/** `all` | `none` | `some` — which of the three outcomes a fan-out ended in. */
export function outcome(results) {
  const done = results.filter((r) => r.ok).length
  if (done === results.length) return 'all'
  if (done === 0) return 'none'
  return 'some'
}
