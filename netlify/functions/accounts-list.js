import { json, CORS } from '../lib/instagram.js'
import { requireAuth, isProtected } from '../lib/auth.js'
import { listAccounts } from '../lib/accounts.js'

/**
 * The connected accounts, without their tokens.
 *
 * GET -> { ok, accounts, protected }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  try {
    requireAuth(event)
    return json(200, { ok: true, accounts: await listAccounts(), protected: isProtected() })
  } catch (error) {
    console.error('Could not list accounts:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
