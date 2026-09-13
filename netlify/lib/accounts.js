import { randomUUID } from 'node:crypto'
import { readDoc, updateDoc } from './store.js'
import { graph, envCredentials } from './instagram.js'

const KEY = 'accounts'

const DAY = 24 * 60 * 60 * 1000

/**
 * Instagram long-lived tokens last 60 days. A fresh one's real expiry is not
 * knowable from the token itself, so it is estimated until the first refresh
 * reports the true `expires_in`.
 */
const ASSUMED_LIFETIME_MS = 60 * DAY

/** Meta refuses to refresh a token younger than this. */
const MIN_AGE_TO_REFRESH_MS = 25 * 60 * 60 * 1000

/** Refresh this far ahead of expiry, so a missed run or two costs nothing. */
const REFRESH_WHEN_WITHIN_MS = 20 * DAY

/** Shown as a warning in the UI once a token gets this close to expiring. */
const WARN_WHEN_WITHIN_MS = 10 * DAY

/**
 * A connected social account.
 *
 * The token lives here and never leaves the server: `publicView` is the only
 * shape that reaches the browser, and it carries a four-character hint instead.
 *
 * @typedef {object} Account
 * @property {string}  id
 * @property {string}  platform      'instagram'
 * @property {string}  username      discovered from the token, not typed
 * @property {string}  externalId    the platform's own account id
 * @property {string}  token         server-only
 * @property {string}  tokenAddedAt
 * @property {?string} tokenExpiresAt
 * @property {boolean} expiryEstimated  true until a refresh reports the real one
 * @property {?string} lastError
 */

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode })

/** What the browser is allowed to see. Never includes the token. */
export function publicView(account) {
  const expiresAt = account.tokenExpiresAt ? Date.parse(account.tokenExpiresAt) : null
  const msLeft = expiresAt ? expiresAt - Date.now() : null

  return {
    id: account.id,
    platform: account.platform,
    username: account.username,
    externalId: account.externalId,
    accountType: account.accountType ?? null,
    tokenHint: `…${String(account.token).slice(-4)}`,
    tokenAddedAt: account.tokenAddedAt,
    tokenExpiresAt: account.tokenExpiresAt,
    expiryEstimated: Boolean(account.expiryEstimated),
    daysLeft: msLeft === null ? null : Math.max(0, Math.floor(msLeft / DAY)),
    expiringSoon: msLeft !== null && msLeft < WARN_WHEN_WITHIN_MS,
    lastRefreshedAt: account.lastRefreshedAt ?? null,
    lastError: account.lastError ?? null,
  }
}

/**
 * Asks Instagram who a token belongs to.
 *
 * This is also the validity check — a token that cannot answer this cannot
 * publish either, so a bad one is rejected before it is ever stored rather
 * than turning into a channel that silently fails weeks later.
 */
export async function identify(token) {
  const trimmed = String(token ?? '').trim()
  if (trimmed.length < 20) throw fail(400, 'That does not look like an access token')

  let me
  try {
    me = await graph('me', { params: { fields: 'user_id,username,account_type' }, token: trimmed })
  } catch (error) {
    // Only the call is wrapped, so our own messages below are not caught here
    // and re-labelled as something Instagram said.
    throw fail(401, `Instagram rejected this token: ${error.message}`)
  }

  if (!me.user_id) throw fail(400, 'Instagram did not return an account for this token')

  return {
    externalId: String(me.user_id),
    username: me.username ?? null,
    accountType: me.account_type ?? null,
  }
}

/**
 * Brings over the single account the app used to run on.
 *
 * Without this, deploying the multi-account version would look like losing the
 * connected channel. Runs once — as soon as one account exists it does nothing.
 */
async function seedFromEnv(accounts) {
  if (accounts.length > 0) return accounts

  const env = envCredentials()
  if (!env) return accounts

  let identity
  try {
    identity = await identify(env.token)
  } catch (error) {
    console.error('Could not adopt the environment credentials:', error.message)
    return accounts
  }

  return [
    {
      id: randomUUID(),
      platform: 'instagram',
      ...identity,
      token: env.token,
      tokenAddedAt: new Date().toISOString(),
      tokenExpiresAt: new Date(Date.now() + ASSUMED_LIFETIME_MS).toISOString(),
      expiryEstimated: true,
      fromEnvironment: true,
      lastError: null,
    },
  ]
}

/** Internal: every account, tokens included. Seeds from the environment once. */
async function allAccounts() {
  const { items } = await readDoc(KEY)
  if (items.length > 0) return items

  const seeded = await seedFromEnv(items)
  if (seeded.length > 0) await updateDoc(KEY, (current) => (current.length ? null : seeded))
  return seeded
}

/** Safe for the browser. */
export async function listAccounts() {
  return (await allAccounts()).map(publicView)
}

/**
 * The credentials to act with.
 *
 * Falls back to the first account on the platform when an id is missing, which
 * is what a post recorded before accounts existed looks like.
 */
export async function resolveAccount(accountId, platform = 'instagram') {
  const accounts = await allAccounts()

  const account =
    (accountId && accounts.find((a) => a.id === accountId)) ||
    accounts.find((a) => a.platform === platform)

  if (!account) {
    throw fail(400, `No ${platform} account is connected. Add one under Channels.`)
  }

  return { id: account.id, token: account.token, userId: account.externalId, account }
}

export async function addAccount({ platform = 'instagram', token }) {
  if (platform !== 'instagram') throw fail(400, `Adding "${platform}" accounts is not supported yet`)

  const identity = await identify(token)
  let created = null

  await updateDoc(KEY, (accounts) => {
    const existing = accounts.find(
      (a) => a.platform === platform && a.externalId === identity.externalId
    )

    const record = {
      id: existing?.id ?? randomUUID(),
      platform,
      ...identity,
      token: String(token).trim(),
      tokenAddedAt: new Date().toISOString(),
      tokenExpiresAt: new Date(Date.now() + ASSUMED_LIFETIME_MS).toISOString(),
      expiryEstimated: true,
      lastError: null,
    }

    created = record

    // Re-adding an account replaces its token rather than duplicating it, so
    // pasting a fresh token is also how you repair an expired channel.
    return existing
      ? accounts.map((a) => (a.id === existing.id ? record : a))
      : [...accounts, record]
  })

  return publicView(created)
}

export async function removeAccount(id) {
  await updateDoc(KEY, (accounts) => accounts.filter((a) => a.id !== id))
  return listAccounts()
}

const dueForRefresh = (account) => {
  const age = Date.now() - Date.parse(account.tokenAddedAt ?? 0)
  if (age < MIN_AGE_TO_REFRESH_MS) return false

  // An estimated expiry is refreshed at the first opportunity, which is also
  // how the real expiry becomes known.
  if (account.expiryEstimated) return true

  const expiresAt = account.tokenExpiresAt ? Date.parse(account.tokenExpiresAt) : 0
  return expiresAt - Date.now() < REFRESH_WHEN_WITHIN_MS
}

/**
 * Extends the tokens that need it.
 *
 * This is what keeps "connect a channel once" true. Instagram tokens die after
 * 60 days, and without this every account would have to be reconnected by hand
 * every two months — which, with several accounts, means posts quietly stopping
 * on a channel nobody was watching.
 */
export async function refreshDueTokens() {
  const accounts = await allAccounts()
  const results = []

  for (const account of accounts) {
    if (account.platform !== 'instagram' || !dueForRefresh(account)) continue

    try {
      const refreshed = await graph('refresh_access_token', {
        params: { grant_type: 'ig_refresh_token' },
        token: account.token,
        versioned: false,
      })

      if (!refreshed.access_token) throw new Error('No token came back')

      const expiresAt = new Date(
        Date.now() + (Number(refreshed.expires_in) || 60 * 86400) * 1000
      ).toISOString()

      await updateDoc(KEY, (current) =>
        current.map((a) =>
          a.id === account.id
            ? {
                ...a,
                token: refreshed.access_token,
                tokenExpiresAt: expiresAt,
                expiryEstimated: false,
                lastRefreshedAt: new Date().toISOString(),
                lastError: null,
              }
            : a
        )
      )

      results.push({ id: account.id, username: account.username, state: 'refreshed', expiresAt })
    } catch (error) {
      // Recorded rather than thrown: one dead token must not stop the others
      // being refreshed, and the channel screen needs to show what went wrong.
      await updateDoc(KEY, (current) =>
        current.map((a) => (a.id === account.id ? { ...a, lastError: error.message } : a))
      )

      console.error(`Token refresh failed for ${account.username}:`, error.message)
      results.push({ id: account.id, username: account.username, state: 'failed', error: error.message })
    }
  }

  return results
}
