import { createContainer, isContainerReady, publishContainer, POST_TYPES } from './instagram.js'
import { publishToPage, FB_POST_TYPES } from './facebook.js'

/**
 * One place that knows which platform publishes how.
 *
 * Two callers need this — the browser-driven publish and the cron — and when
 * they each carried their own knowledge of Instagram's two-step container they
 * drifted, which is how a post published on the fast path lost the account it
 * belonged to. A second platform doubles the chances of that, so the
 * difference lives here and nowhere else.
 *
 * The shapes are genuinely different, and the return says so rather than
 * flattening them:
 *
 *   Instagram  media container, then a publish step. Often not ready at once,
 *              so this can hand back a containerId to finish later.
 *   Facebook   the Page takes the photo and posts it in one request. There is
 *              nothing to wait for and never a containerId.
 */

/** What each platform will accept, so a post is refused here and not at Meta. */
export function supportsPostType(platform, postType) {
  return platform === 'facebook'
    ? Boolean(FB_POST_TYPES[postType])
    : Boolean(POST_TYPES[postType])
}

/**
 * Starts a post, and finishes it when the platform allows.
 *
 * @returns {Promise<{done: boolean, mediaId?: string, containerId?: string}>}
 *          done:true carries the published id; done:false carries the
 *          containerId the caller polls with.
 */
export async function startPublish({ platform = 'instagram', post, ctx }) {
  if (!supportsPostType(platform, post.postType)) {
    throw Object.assign(
      new Error(
        platform === 'facebook'
          ? `Facebook Pages cannot take a ${post.postType} post from this app yet.`
          : `Unknown postType "${post.postType}".`
      ),
      { statusCode: 400 }
    )
  }

  if (platform === 'facebook') {
    const mediaId = await publishToPage(post, ctx)
    return { done: true, mediaId, containerId: null }
  }

  const containerId = await createContainer(post, ctx)

  // One status check, never a wait loop: a synchronous Netlify function is cut
  // off at 10s and an image is normally ready straight away, so the common case
  // finishes here and the slow case is handed back to be polled.
  if (await isContainerReady(containerId, ctx.token)) {
    return { done: true, mediaId: await publishContainer(containerId, ctx.userId, ctx.token), containerId }
  }

  return { done: false, containerId }
}
