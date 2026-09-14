import { json, CORS } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { resolveAccount } from '../lib/accounts.js'
import { sendTo } from '../lib/messages.js'

/**
 * Replies in one conversation, as the account that owns it.
 *
 * POST { "recipientId": "...", "text": "...", "accountId": "..." }
 *
 * Meta only allows this within 24 hours of the person's last message. The
 * screen already hides the box once that has passed; this refuses anyway,
 * because a stale page is exactly the case where it would still be offered.
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

    const { recipientId, text, accountId } = body
    const ctx = await resolveAccount(accountId)
    const messageId = await sendTo({ recipientId, text }, ctx)

    return json(200, { ok: true, messageId, accountId: ctx.id })
  } catch (error) {
    console.error('Sending a message failed:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
