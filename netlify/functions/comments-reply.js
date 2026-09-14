import { json, CORS } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { resolveAccount } from '../lib/accounts.js'
import { replyTo } from '../lib/comments.js'

/**
 * Replies to one comment, as the account whose post it sits under.
 *
 * POST { "commentId": "...", "message": "...", "accountId": "..." }
 *
 * accountId is not optional in spirit: a reply sent as the wrong channel is
 * published under the wrong name in front of a customer, and cannot be taken
 * back. It falls back to the first account only because a single-channel setup
 * has no other answer.
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    requireAuth(event)

    let body
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return json(400, { error: 'Request body is not valid JSON' })
    }

    const { commentId, message, accountId } = body
    if (!commentId) return json(400, { error: 'commentId is required' })

    const { id, token } = await resolveAccount(accountId)
    const replyId = await replyTo(commentId, message, token)

    return json(200, { ok: true, replyId, accountId: id })
  } catch (error) {
    console.error('Reply failed:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
