import { json, CORS, requireCredentials, graph } from '../lib/instagram.js'

/**
 * Confirms the configured credentials actually work, without ever returning
 * the token itself. Call this first after setting the environment variables:
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

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  try {
    const { token, userId } = requireCredentials()

    const me = await graph('me', {
      params: { fields: 'user_id,username,account_type' },
      token,
    })

    const limit = await graph(`${userId}/content_publishing_limit`, {
      params: { fields: 'config,quota_usage' },
      token,
    }).catch(() => null)

    return json(200, {
      ok: true,
      username: me.username,
      accountType: me.account_type ?? null,
      // Surfaced so you can confirm IG_USER_ID matches the token's own account.
      userIdMatches: String(me.user_id) === String(userId),
      quotaUsed: limit?.data?.[0]?.quota_usage ?? null,
      quotaTotal: limit?.data?.[0]?.config?.quota_total ?? null,
      insights: await probeInsights(userId, token),
    })
  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      error: error.message,
      metaCode: error.metaCode ?? null,
    })
  }
}
