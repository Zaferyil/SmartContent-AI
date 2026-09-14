import { api } from './api'

/**
 * Comments waiting on an answer. Omit accountId for every connected channel.
 *
 * @returns {Promise<{ comments: Array, channels: Array }>}
 */
export const fetchComments = (accountId) =>
  api('comments-list', accountId ? { query: { accountId } } : undefined)

/** Posts a reply under one comment, as the account that owns the post. */
export const replyToComment = ({ commentId, message, accountId }) =>
  api('comments-reply', { body: { commentId, message, accountId } })
