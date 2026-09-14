import { api } from './api'

const POLL_INTERVAL_MS = 2000

/**
 * How long to keep asking whether the media is ready.
 *
 * An image is normally finished before the first check. A reel is transcoded by
 * Instagram after it has fetched the file, and a long one takes minutes — the
 * two-minute window that is generous for an image gives up on a video that was
 * going to succeed, and reports it as a failure the user cannot tell from a real
 * one.
 */
const POLL_TIMEOUT_MS = 120000
const VIDEO_POLL_TIMEOUT_MS = 600000

const NEEDS_VIDEO = new Set(['REELS', 'VIDEO'])

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
export async function publishPost(
  { imageUrl, imageUrls, videoUrl, caption, postType, accountId },
  { onProgress } = {}
) {
  const started = await api('instagram-publish', {
    // imageUrls is the carousel's images, videoUrl the reel's. Leaving either
    // out of this body is how a post reaches the server with no media at all.
    body: { imageUrl, imageUrls, videoUrl, caption, postType, accountId },
  })

  // This endpoint always answers with a body. Reading `.done` off nothing is
  // how the last failure surfaced — as "null is not an object", which tells
  // the user nothing about their post.
  if (!started) throw new Error('Instagram publishing returned an empty response')

  if (started.done) return started.mediaId

  const budget = NEEDS_VIDEO.has(postType) ? VIDEO_POLL_TIMEOUT_MS : POLL_TIMEOUT_MS
  const deadline = Date.now() + budget
  let attempt = 0

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    attempt += 1
    onProgress?.(attempt)

    // The post details ride along so the finish step can record the published
    // post itself — it is the half that publishes when the media was slow,
    // which for a reel is every time.
    const status = await api('instagram-publish-finish', {
      body: {
        containerId: started.containerId,
        accountId: started.accountId ?? accountId,
        imageUrl,
        videoUrl,
        caption,
        postType,
      },
    })

    if (status?.done) return status.mediaId
  }

  throw new Error('Instagram is still processing the media — try again in a moment')
}
