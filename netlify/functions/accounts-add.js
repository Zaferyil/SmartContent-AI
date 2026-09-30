import { json, CORS } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { addAccount } from '../lib/accounts.js'

/**
 * Connects an account from its access token alone.
 *
 * The account id and username are read back from the platform rather than
 * typed, so there is nothing to mistype, and a token that cannot identify
 * itself is refused instead of stored.
 *
 * POST { "token": "IGQ..." }                                   Instagram
 * POST { "platform": "facebook", "token": "EAA...", "pageId": "123" }
 *   -> 200 { ok: true, account }
 *
 * `pageId` is only needed when a Facebook token manages several Pages: with
 * one it is worked out, and with several the error names them rather than
 * guessing which audience to publish to.
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

    const account = await addAccount({
      platform: body.platform,
      token: body.token,
      pageId: body.pageId,
    })
    return json(200, { ok: true, account })
  } catch (error) {
    console.error('Could not add the account:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
