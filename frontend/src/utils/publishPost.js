const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 120000

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok && response.status !== 202) {
    throw new Error(data.error || `Request failed (HTTP ${response.status})`)
  }
  return data
}

/**
 * Publishes a post, polling while Instagram processes the media.
 *
 * The work is split across two endpoints so no single request can hit Netlify's
 * 10s function limit: instagram-publish creates the container and publishes
 * immediately when the media is already processed (the normal case for an
 * image), otherwise it returns a containerId that instagram-publish-finish
 * resolves one check at a time.
 *
 * @param onProgress called with the attempt count while waiting, so the UI can
 *                   show that something is still happening.
 */
export async function publishPost({ imageUrl, caption, postType }, { onProgress } = {}) {
  const started = await postJson('/.netlify/functions/instagram-publish', {
    imageUrl,
    caption,
    postType,
  })

  if (started.done) return started.mediaId

  const deadline = Date.now() + POLL_TIMEOUT_MS
  let attempt = 0

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    attempt += 1
    onProgress?.(attempt)

    const status = await postJson('/.netlify/functions/instagram-publish-finish', {
      containerId: started.containerId,
    })

    if (status.done) return status.mediaId
  }

  throw new Error('Instagram is still processing the media — try again in a moment')
}
