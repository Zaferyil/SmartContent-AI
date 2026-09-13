import { json, CORS, graph } from '../lib/instagram.js'
import { requireAuth } from '../lib/auth.js'
import { listAccounts, resolveAccount } from '../lib/accounts.js'

/**
 * Confirms the connected accounts actually work, without ever returning a
 * token. Checks every account unless `?accountId=` names one.
 *
 *   curl https://<site>/.netlify/functions/instagram-verify
 */
// Metrics as of Graph API v22: `impressions` and `video_views` were removed,
// `views` replaces them.
const MEDIA_METRICS = 'views,reach,likes,comments,saved,shares'

/**
 * Reports whether this token can actually read insights.
 *
 * instagram_business_manage_insights is a separate permission from publishing,
 * and adding it in the app dashboard does not upgrade an existing token — it
 * has to be regenerated. Nothing else here notices the difference, so a caller
 * would otherwise discover it only when the analytics screen came back empty.
 */
async function probeInsights(userId, token) {
  try {
    const media = await graph(`${userId}/media`, { params: { fields: 'id', limit: 1 }, token })
    const latest = media.data?.[0]

    if (!latest) return { available: null, reason: 'no published media to test against' }

    await graph(`${latest.id}/insights`, { params: { metric: MEDIA_METRICS }, token })
    return { available: true }
  } catch (error) {
    return {
      available: false,
      reason: error.message,
      metaCode: error.metaCode ?? null,
    }
  }
}

async function checkOne(accountId) {
  const { token, userId, account } = await resolveAccount(accountId)

  const me = await graph('me', { params: { fields: 'user_id,username,account_type' }, token })

  const limit = await graph(`${userId}/content_publishing_limit`, {
    params: { fields: 'config,quota_usage' },
    token,
  }).catch(() => null)

  return {
    ok: true,
    accountId: account.id,
    username: me.username,
    accountType: me.account_type ?? null,
    quotaUsed: limit?.data?.[0]?.quota_usage ?? null,
    quotaTotal: limit?.data?.[0]?.config?.quota_total ?? null,
    insights: await probeInsights(userId, token),
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  try {
    requireAuth(event)

    const only = event.queryStringParameters?.accountId
    const accounts = only ? [{ id: only }] : await listAccounts()

    if (accounts.length === 0) {
      return json(200, { ok: true, accounts: [], note: 'No accounts connected yet' })
    }

    // One broken account is reported rather than hiding the state of the rest.
    const results = await Promise.all(
      accounts.map((a) =>
        checkOne(a.id).catch((error) => ({
          ok: false,
          accountId: a.id,
          error: error.message,
          metaCode: error.metaCode ?? null,
        }))
      )
    )

    return json(200, { ok: true, accounts: results })
  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      error: error.message,
      metaCode: error.metaCode ?? null,
    })
  }
}
