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

/**
 * The same request without anything optional.
 *
 * Asking for a field an account is not allowed to read can make Meta answer 200
 * with an empty list rather than an error, which is indistinguishable from
 * having no comments. When the post's own comment count says otherwise, this
 * runs as a second attempt: if the plain request returns the comments, the
 * fuller one was the problem, and we have both the answer and the fix.
 */
const MINIMAL_FIELDS = 'id,text,timestamp,username'

const recent = (timestamp) =>
  Date.now() - Date.parse(timestamp) < WITHIN_DAYS * 24 * 60 * 60 * 1000

/**
 * One post's comments, each marked with whether this account has replied.
 *
 * "Answered" is a reply written by the account itself. Instagram offers no flag
 * for it, and the distinction is the whole point of the screen — an unanswered
 * question under a post is the one thing here that costs money.
 */
async function commentsOn(media, account, token, fields = COMMENT_FIELDS) {
  const { data = [] } = await graph(`${media.id}/comments`, {
    params: { fields },
    token,
  })

  const kept = data
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

  // `read` is everything the API returned, before our own comments are dropped.
  // Comparing that against Instagram's own count is what shows whether comments
  // are being withheld; comparing the filtered list would count our own replies
  // as missing.
  return { kept, read: data.length }
}

/**
 * Every comment worth showing for one account, newest first.
 *
 * The posts are read first and then their comments all at once: ten posts one
 * after another is ten round trips, which on a synchronous function is most of
 * the budget before anything is rendered.
 */
export async function listForAccount(account, token) {
  // comments_count is Instagram's own count for the post. Asking for it costs
  // nothing extra and settles the question the counts alone cannot: whether a
  // post with no comments here has none at all, or has some this token is not
  // being shown.
  const { data: media = [] } = await graph('me/media', {
    params: {
      fields: 'id,caption,media_url,permalink,timestamp,comments_count',
      limit: MAX_MEDIA,
    },
    token,
  })

  const worth = media.filter((item) => !item.timestamp || recent(item.timestamp))

  const perMedia = await Promise.all(
    worth.map(async (item) => {
      const reported = item.comments_count ?? 0
      try {
        let { kept, read } = await commentsOn(item, account, token)
        let retried = null

        // Instagram says this post has comments and handed over none, without
        // calling it an error. Try again asking for less before believing it.
        if (read === 0 && reported > 0) {
          const plain = await commentsOn(item, account, token, MINIMAL_FIELDS)
          retried = plain.read
          if (plain.read > 0) {
            kept = plain.kept
            read = plain.read
          }
        }

        return { comments: kept, read, reported, retried, id: item.id, error: null }
      } catch (error) {
        // One post failing must not empty the whole screen — a deleted post or
        // one with comments turned off answers with an error of its own.
        console.error(`Comments on ${item.id} failed:`, error.message)
        return { comments: [], read: 0, reported, retried: null, id: item.id, error: error.message }
      }
    })
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
    // What Instagram says is there, against what we managed to read. A gap
    // between the two is the one thing that separates "nothing was written"
    // from "we are not being shown it".
    reportedComments: worth.reduce((sum, item) => sum + (item.comments_count ?? 0), 0),
    readComments: perMedia.reduce((sum, r) => sum + r.read, 0),
    // Only the posts where the two numbers disagree. Everything matching is
    // noise; the ones that do not are the whole question.
    mismatched: perMedia
      .filter((r) => !r.error && r.reported > r.read)
      .map((r) => ({ id: r.id, reported: r.reported, read: r.read, retried: r.retried })),
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
