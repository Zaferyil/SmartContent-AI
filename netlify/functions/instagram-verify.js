import { json, CORS, requireCredentials, graph } from '../lib/instagram.js'

/**
 * Confirms the configured credentials actually work, without ever returning
 * the token itself. Call this first after setting the environment variables:
 *
 *   curl https://<site>/.netlify/functions/instagram-verify
 */
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
    })
  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      error: error.message,
      metaCode: error.metaCode ?? null,
    })
  }
}
