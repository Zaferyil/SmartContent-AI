import { json, CORS } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { removeAccount } from '../lib/accounts.js'

/**
 * Disconnects an account.
 *
 * This forgets the token. Posts already published stay on Instagram, and the
 * recorded history stays in the reports — only the ability to act as this
 * account goes away.
 *
 * POST { "id": "..." } -> 200 { ok: true, accounts }
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

    if (!body.id) return json(400, { error: 'Provide the id of the account to remove' })

    return json(200, { ok: true, accounts: await removeAccount(body.id) })
  } catch (error) {
    console.error('Could not remove the account:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
