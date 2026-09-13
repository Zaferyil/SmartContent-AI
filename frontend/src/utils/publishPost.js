import { api } from './api'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 120000

/**
 * Publishes a post, polling while Instagram processes the media.
 *
 * The work is split across two endpoints so no single request can hit Netlify's
 * 10s function limit: instagram-publish creates the container and publishes
 * immediately when the media is already processed (the normal case for an
 * image), otherwise it returns a containerId that instagram-publish-finish
 * resolves one check at a time.
 *
 * `accountId` decides which connected account publishes, and the finish step is
 * given the same one — a container belongs to the account that created it.
 *
 * @param onProgress called with the attempt count while waiting, so the UI can
 *                   show that something is still happening.
 */
export async function publishPost({ imageUrl, caption, postType, accountId }, { onProgress } = {}) {
  const started = await api('instagram-publish', {
    body: { imageUrl, caption, postType, accountId },
  })

  if (started.done) return started.mediaId

  const deadline = Date.now() + POLL_TIMEOUT_MS
  let attempt = 0

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    attempt += 1
    onProgress?.(attempt)

    // The post details ride along so the finish step can record the published
    // post itself — it is the half that publishes when the media was slow.
    const status = await api('instagram-publish-finish', {
      body: {
        containerId: started.containerId,
        accountId: started.accountId ?? accountId,
        imageUrl,
        caption,
        postType,
      },
    })

    if (status.done) return status.mediaId
  }

  throw new Error('Instagram is still processing the media — try again in a moment')
}
