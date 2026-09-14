import { graph } from './instagram.js'

/**
 * Comments on an account's recent posts, and replies to them.
 *
 * Read rather than pushed: Instagram will send a webhook for every comment, but
 * only to an app that is Live, and this one is not. Asking for them instead
 * costs a call per post and needs nothing set up, at the price of finding out
 * on the next load rather than the same second. For answering a parent asking
 * how old their child needs to be, that is not a meaningful difference.
 */

/**
 * How far back to look. Instagram allows 200 calls an hour per account and each
 * post costs one, so this is the budget as much as it is a window: a comment on
 * something posted two months ago is rare, and the quota is better spent on
 * being able to refresh the recent ones often.
 */
const MAX_MEDIA = 10
const WITHIN_DAYS = 45

const COMMENT_FIELDS =
  'id,text,timestamp,username,like_count,hidden,replies{id,text,timestamp,username}'

const recent = (timestamp) =>
  Date.now() - Date.parse(timestamp) < WITHIN_DAYS * 24 * 60 * 60 * 1000

/**
 * One post's comments, each marked with whether this account has replied.
 *
 * "Answered" is a reply written by the account itself. Instagram offers no flag
 * for it, and the distinction is the whole point of the screen — an unanswered
 * question under a post is the one thing here that costs money.
 */
async function commentsOn(media, account, token) {
  const { data = [] } = await graph(`${media.id}/comments`, {
    params: { fields: COMMENT_FIELDS },
    token,
  })

  return data
    // Our own comments are not questions to answer.
    .filter((comment) => comment.username !== account.username)
    .map((comment) => {
      const replies = comment.replies?.data ?? []
      return {
        id: comment.id,
        text: comment.text ?? '',
        timestamp: comment.timestamp,
        username: comment.username ?? null,
        likeCount: comment.like_count ?? 0,
        hidden: Boolean(comment.hidden),
        answered: replies.some((reply) => reply.username === account.username),
        replies: replies.map((reply) => ({
          id: reply.id,
          text: reply.text ?? '',
          timestamp: reply.timestamp,
          username: reply.username ?? null,
          mine: reply.username === account.username,
        })),
        media: {
          id: media.id,
          permalink: media.permalink ?? null,
          thumbnail: media.thumbnail_url ?? media.media_url ?? null,
          caption: media.caption ?? '',
        },
        accountId: account.id,
        accountUsername: account.username,
      }
    })
}

/**
 * Every comment worth showing for one account, newest first.
 *
 * The posts are read first and then their comments all at once: ten posts one
 * after another is ten round trips, which on a synchronous function is most of
 * the budget before anything is rendered.
 */
export async function listForAccount(account, token) {
  const { data: media = [] } = await graph('me/media', {
    params: { fields: 'id,caption,media_url,permalink,timestamp', limit: MAX_MEDIA },
    token,
  })

  const worth = media.filter((item) => !item.timestamp || recent(item.timestamp))

  const perMedia = await Promise.all(
    worth.map((item) =>
      commentsOn(item, account, token)
        .then((comments) => ({ comments, error: null }))
        .catch((error) => {
          // One post failing must not empty the whole screen — a deleted post
          // or one with comments turned off answers with an error of its own.
          console.error(`Comments on ${item.id} failed:`, error.message)
          return { comments: [], error: error.message }
        })
    )
  )

  const failures = perMedia.map((r) => r.error).filter(Boolean)

  return {
    comments: perMedia.flatMap((r) => r.comments),
    // Counted and handed back rather than swallowed. Every post failing looks
    // exactly like no post having a comment, and the screen cannot tell the
    // difference on its own — which is the whole reason it silently showed
    // nothing when the token was missing the comments permission.
    posts: media.length,
    checked: worth.length,
    failures,
  }
}

/** Replies to a comment as the account that owns the post. */
export async function replyTo(commentId, message, token) {
  const text = String(message ?? '').trim()
  if (!text) {
    throw Object.assign(new Error('A reply needs some text'), { statusCode: 400 })
  }

  const created = await graph(`${commentId}/replies`, {
    method: 'POST',
    params: { message: text },
    token,
  })

  return created.id
}

/** Unanswered first, then newest — the order the work should be done in. */
export const byUrgency = (a, b) => {
  if (a.answered !== b.answered) return a.answered ? 1 : -1
  return (b.timestamp ?? '').localeCompare(a.timestamp ?? '')
}
