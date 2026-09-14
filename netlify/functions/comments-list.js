import { json, CORS } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { listAccounts, resolveAccount } from '../lib/accounts.js'
import { listForAccount, byUrgency } from '../lib/comments.js'

/**
 * Comments waiting on an answer, across the connected accounts.
 *
 * GET                  -> every account
 * GET ?accountId=...   -> one of them
 *
 * Each account is read with its own credentials and its own failure: a channel
 * whose token has expired must not blank out the other one's inbox, so it comes
 * back as an error beside the comments rather than instead of them.
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
      return json(200, { ok: true, comments: [], channels: [] })
    }

    const results = await Promise.all(
      chosen.map(async (account) => {
        try {
          const { token } = await resolveAccount(account.id, account.platform)
          return { account, comments: await listForAccount(account, token), error: null }
        } catch (error) {
          console.error(`Comments for ${account.username} failed:`, error.message)
          return { account, comments: [], error: error.message }
        }
      })
    )

    return json(200, {
      ok: true,
      comments: results.flatMap((r) => r.comments).sort(byUrgency),
      channels: results.map((r) => ({
        id: r.account.id,
        username: r.account.username,
        count: r.comments.length,
        unanswered: r.comments.filter((c) => !c.answered).length,
        error: r.error,
      })),
    })
  } catch (error) {
    console.error('Could not list comments:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
