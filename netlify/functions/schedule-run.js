import { json, CORS, createContainer, isContainerReady, publishContainer } from '../lib/instagram.js'
import { resolveAccount } from '../lib/accounts.js'
import {
  listScheduled,
  dueNow,
  patchScheduled,
  NEEDS_ITS_VIDEO,
  PUBLISHABLE_PLATFORMS,
} from '../lib/schedule.js'
import { recordPublished } from '../lib/posts.js'
import { deleteVideoByUrl } from '../lib/r2.js'

/**
 * Publishes whatever is due. Declared as a scheduled function in netlify.toml.
 *
 * A scheduled function is cut off at 30 seconds, and one Instagram publish
 * measured 9.5s of that, so this never tries to drain the queue in a single
 * run. Instead each run does the smallest useful unit of work and leaves the
 * rest for the next one, five minutes later:
 *
 *   scheduled  -> create the media container, mark 'publishing'
 *   publishing -> container ready? publish it and mark 'published'
 *
 * Splitting it this way also survives the case that would otherwise be worst:
 * Instagram still processing the media when the clock runs out. Nothing is
 * lost, because the container id is written down before anything can time out.
 *
 * At five-minute cadence with two items a run this clears 24 posts an hour,
 * which is far more than a schedule built around preferred times ever needs.
 */

const MAX_PER_RUN = 2

// Stop starting new work once this much of the 30s budget is gone. Finishing a
// started item costs one cheap call; starting one costs the expensive one.
const START_BUDGET_MS = 15000

// Meta rejects a container whose media it could not fetch, and retrying that
// forever would hammer the API with a request that cannot start working.
const MAX_ATTEMPTS = 3

/**
 * Publishes a container that has finished processing and writes the result down.
 *
 * Both branches below reach this point, and when they each spelled it out the
 * two copies drifted: one recorded which account had published, the other did
 * not, so a post that happened to go out on the fast path lost its account and
 * was left out of that account's reports.
 */
async function finish(item, containerId, ctx) {
  const mediaId = await publishContainer(containerId, ctx.userId, ctx.token)

  await recordPublished({
    mediaId,
    accountId: ctx.id,
    // A carousel has no single image; the first one is what the reports show.
    imageUrl: item.imageUrl ?? item.imageUrls?.[0] ?? null,
    videoUrl: item.videoUrl ?? null,
    caption: item.caption,
    postType: item.postType,
  }).catch((e) => console.error('Could not record the published post:', e.message))

  await patchScheduled(item.id, { status: 'published', mediaId, error: null })
  await releaseVideo(item)

  return { id: item.id, state: 'published', mediaId }
}

/**
 * Removes a published reel's video — but only once nothing else needs it.
 *
 * Scheduling a reel to two channels writes two items pointing at one file, and
 * they rarely publish in the same run: two per run, five minutes apart. Deleting
 * on the first one would pull the video out from under the second, which would
 * then fail with Instagram unable to fetch the media — the kind of failure that
 * looks like Instagram's fault and is entirely ours. A draft counts too, and so
 * does a failed one: both are posts that may still be sent.
 *
 * Storage is housekeeping, so nothing here is allowed to turn a published post
 * into a failed run.
 */
async function releaseVideo(item) {
  if (item.postType !== 'REELS' || !item.videoUrl) return

  try {
    const others = await listScheduled()
    const stillNeeded = others.some(
      (other) =>
        other.id !== item.id && other.videoUrl === item.videoUrl && NEEDS_ITS_VIDEO(other)
    )
    if (stillNeeded) return

    await deleteVideoByUrl(item.videoUrl)
  } catch (error) {
    console.error('Could not remove the published reel from storage:', error.message)
  }
}

async function advance(item) {
  // Resolved per item, not per run: two due posts can belong to two different
  // connected accounts, and publishing one as the other would be worse than
  // not publishing at all.
  const ctx = await resolveAccount(item.accountId, item.platform)

  if (item.status === 'publishing' && item.containerId) {
    if (!(await isContainerReady(item.containerId, ctx.token))) {
      return { id: item.id, state: 'still-processing' }
    }
    return finish(item, item.containerId, ctx)
  }

  const containerId = await createContainer(
    {
      imageUrl: item.imageUrl,
      imageUrls: item.imageUrls,
      videoUrl: item.videoUrl,
      caption: item.caption,
      postType: item.postType,
    },
    ctx
  )

  // Written down before the readiness check: if this run dies right here, the
  // next one finds the container instead of creating a second one.
  await patchScheduled(item.id, {
    status: 'publishing',
    containerId,
    attempts: (item.attempts ?? 0) + 1,
  })

  if (await isContainerReady(containerId, ctx.token)) {
    return finish(item, containerId, ctx)
  }

  return { id: item.id, state: 'processing', containerId }
}

export const handler = async (event) => {
  if (event?.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  const startedAt = Date.now()
  const results = []

  try {
    const items = await listScheduled()

    const due = dueNow(items).filter((item) => PUBLISHABLE_PLATFORMS.includes(item.platform))

    for (const item of due) {
      if (results.length >= MAX_PER_RUN) break
      if (Date.now() - startedAt > START_BUDGET_MS) break

      try {
        results.push(await advance(item))
      } catch (error) {
        const attempts = (item.attempts ?? 0) + 1
        const exhausted = attempts >= MAX_ATTEMPTS

        await patchScheduled(item.id, {
          status: exhausted ? 'failed' : 'scheduled',
          attempts,
          containerId: null,
          error: error.message,
        })

        console.error(`Scheduled publish failed for ${item.id}:`, error.message)
        results.push({ id: item.id, state: exhausted ? 'failed' : 'will-retry', error: error.message })
      }
    }

    return json(200, {
      ok: true,
      checked: due.length,
      handled: results.length,
      results,
      tookMs: Date.now() - startedAt,
    })
  } catch (error) {
    console.error('Schedule run failed:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message, results })
  }
}
