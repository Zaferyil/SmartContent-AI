import { json, CORS } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { listAccounts, resolveAccount } from '../lib/accounts.js'
import { listForAccount, byUrgency } from '../lib/messages.js'

/**
 * Direct-message conversations across the connected accounts.
 *
 * GET -> { ok, conversations, channels }
 *
 * Each account is read with its own credentials and reports its own failure,
 * so a channel whose token cannot read messages says so beside the other
 * channel's conversations rather than emptying the screen.
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  try {
    requireAuth(event)

    const wanted = event.queryStringParameters?.accountId
    const accounts = await listAccounts()
    const chosen = wanted ? accounts.filter((a) => a.id === wanted) : accounts

    if (chosen.length === 0) {
      return json(200, { ok: true, conversations: [], channels: [] })
    }

    const results = await Promise.all(
      chosen.map(async (account) => {
        try {
          const { token } = await resolveAccount(account.id, account.platform)
          const found = await listForAccount(account, token)
          return { account, ...found, error: null }
        } catch (error) {
          console.error(`Messages for ${account.username} failed:`, error.message)
          return { account, conversations: [], route: null, found: 0, error: error.message }
        }
      })
    )

    return json(200, {
      ok: true,
      conversations: results.flatMap((r) => r.conversations).sort(byUrgency),
      channels: results.map((r) => ({
        id: r.account.id,
        username: r.account.username,
        // What Instagram handed over against what survived shaping: a
        // conversation with no readable message is dropped, and an inbox that
        // is empty for that reason must not look like an inbox with no mail.
        found: r.found,
        usable: r.conversations.length,
        waiting: r.conversations.filter((c) => !c.answered).length,
        route: r.route,
        error: r.error,
      })),
    })
  } catch (error) {
    console.error('Could not list messages:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
