import { json, CORS } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { listActive } from '../lib/etsy.js'

/**
 * The shop's live listings, newest first, for the Create screen to pick from.
 *
 * GET /etsy-listings?limit=24
 *   -> 200 { ok, shop, total, complete, listings: [...] }
 *
 * Read-only: this reaches Etsy with the app keystring and can only ask for
 * listings that are already public on etsy.com. The keystring never leaves the
 * server, and nothing here can alter the shop.
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  try {
    requireAuth(event)

    const asked = Number(event.queryStringParameters?.limit)
    const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, 100) : 24

    return json(200, { ok: true, ...(await listActive({ limit })) })
  } catch (error) {
    console.error('Could not read the Etsy shop:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
