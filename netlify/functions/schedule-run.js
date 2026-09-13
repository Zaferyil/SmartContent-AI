import { json, CORS, createContainer, isContainerReady, publishContainer } from '../lib/instagram.js'
import { resolveAccount } from '../lib/accounts.js'
import { listScheduled, dueNow, patchScheduled, PUBLISHABLE_PLATFORMS } from '../lib/schedule.js'
import { recordPublished } from '../lib/posts.js'

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

async function advance(item) {
  // Resolved per item, not per run: two due posts can belong to two different
  // connected accounts, and publishing one as the other would be worse than
  // not publishing at all.
  const ctx = await resolveAccount(item.accountId, item.platform)

  if (item.status === 'publishing' && item.containerId) {
    if (!(await isContainerReady(item.containerId, ctx.token))) {
      return { id: item.id, state: 'still-processing' }
    }

    const mediaId = await publishContainer(item.containerId, ctx.userId, ctx.token)
    await recordPublished({
      mediaId,
      accountId: ctx.id,
      imageUrl: item.imageUrl,
      caption: item.caption,
      postType: item.postType,
    }).catch((e) => console.error('Could not record the published post:', e.message))

    await patchScheduled(item.id, { status: 'published', mediaId, error: null })
    return { id: item.id, state: 'published', mediaId }
  }

  const containerId = await createContainer(
    { imageUrl: item.imageUrl, caption: item.caption, postType: item.postType },
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
    const mediaId = await publishContainer(containerId, ctx.userId, ctx.token)
    await recordPublished({
      mediaId,
      imageUrl: item.imageUrl,
      caption: item.caption,
      postType: item.postType,
    }).catch((e) => console.error('Could not record the published post:', e.message))

    await patchScheduled(item.id, { status: 'published', mediaId, error: null })
    return { id: item.id, state: 'published', mediaId }
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
