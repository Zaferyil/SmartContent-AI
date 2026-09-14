import { graph } from './instagram.js'

/**
 * Direct messages, and replies to them.
 *
 * Instagram will push these over a webhook, but only to an app that is Live.
 * Reading them instead needs nothing set up and costs a handful of calls, at
 * the price of seeing a message on the next load rather than the same second.
 *
 * The expensive part is the shape of the API: conversations, then each
 * conversation's messages, then each message's contents is three levels and
 * hundreds of calls for a busy inbox. Asking for all three levels in one nested
 * request is the difference between one call and two hundred, so that is the
 * first thing tried, with the flatter routes kept as fallbacks for when Meta
 * declines to nest.
 */

const MAX_CONVERSATIONS = 15
const MAX_MESSAGES = 12

/** Meta's rule: an account may only reply within a day of being written to. */
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000

const MESSAGE_FIELDS = 'id,created_time,from,to,message'

const at = (value) => {
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** One conversation, as the screen needs it. */
function shape(conversation, account) {
  const rows = conversation.messages?.data ?? []

  const messages = rows
    .map((row) => ({
      id: row.id,
      text: row.message ?? '',
      at: at(row.created_time),
      from: row.from ?? null,
      // Ours is the one sent by the connected account itself.
      mine: String(row.from?.id ?? '') === String(account.externalId),
    }))
    .filter((message) => message.at)
    .sort((a, b) => a.at.localeCompare(b.at))

  // Whoever is not us. Taken from the messages rather than a participants list,
  // which the conversations edge does not return by default.
  const other =
    messages.find((message) => !message.mine)?.from ??
    rows.map((row) => (row.to?.data ?? []).find((p) => String(p.id) !== String(account.externalId)))
      .find(Boolean) ??
    null

  const lastInbound = [...messages].reverse().find((message) => !message.mine) ?? null
  const msLeft = lastInbound ? REPLY_WINDOW_MS - (Date.now() - Date.parse(lastInbound.at)) : 0
  const last = messages[messages.length - 1] ?? null

  return {
    id: conversation.id,
    accountId: account.id,
    accountUsername: account.username,
    participant: other ? { id: String(other.id), username: other.username ?? null } : null,
    messages,
    lastAt: last?.at ?? at(conversation.updated_time) ?? null,
    lastInboundAt: lastInbound?.at ?? null,
    // Answered means we wrote after they did. An account that has not replied
    // to the newest inbound message is the one with work to do.
    answered: Boolean(last && last.mine),
    // Meta refuses a reply outside the window, so the screen must not offer one.
    canReply: msLeft > 0,
    hoursLeft: msLeft > 0 ? Math.max(1, Math.round(msLeft / 3_600_000)) : 0,
  }
}

/** Everything in one request, if Meta will nest it. */
const nested = (token) =>
  graph('me/conversations', {
    params: {
      fields: `id,updated_time,messages.limit(${MAX_MESSAGES}){${MESSAGE_FIELDS}}`,
      limit: MAX_CONVERSATIONS,
    },
    token,
  })

/** The flat route: conversations, then each one's messages. */
async function flat(token) {
  const { data = [] } = await graph('me/conversations', {
    params: { fields: 'id,updated_time', limit: MAX_CONVERSATIONS },
    token,
  })

  const filled = await Promise.all(
    data.map(async (conversation) => {
      try {
        const detail = await graph(conversation.id, {
          params: { fields: `messages.limit(${MAX_MESSAGES}){${MESSAGE_FIELDS}}` },
          token,
        })
        return { ...conversation, messages: detail.messages }
      } catch (error) {
        console.error(`Conversation ${conversation.id} failed:`, error.message)
        return conversation
      }
    })
  )

  return { data: filled }
}

/**
 * Conversations with their messages, newest activity first.
 *
 * @returns {Promise<{ conversations: Array, route: string, found: number }>}
 */
export async function listForAccount(account, token) {
  let raw
  let route = 'nested'

  try {
    raw = await nested(token)
    // Nesting can succeed and still come back without the contents. Falling
    // back on that rather than on an error is the difference between an inbox
    // of blank rows and one that works.
    const gotText = (raw.data ?? []).some((c) =>
      (c.messages?.data ?? []).some((m) => typeof m.message === 'string')
    )
    if (!gotText && (raw.data ?? []).length > 0) {
      raw = await flat(token)
      route = 'flat'
    }
  } catch (error) {
    console.error('Nested conversations failed:', error.message)
    raw = await flat(token)
    route = 'flat'
  }

  const conversations = (raw.data ?? [])
    .map((conversation) => shape(conversation, account))
    .filter((conversation) => conversation.messages.length > 0)
    .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))

  return { conversations, route, found: (raw.data ?? []).length }
}

/**
 * Sends a message to one person, as the connected account.
 *
 * recipient and message are objects, and this API is called form-encoded, so
 * they travel as JSON strings — passing them as objects would arrive as
 * "[object Object]" and be refused for reasons that say nothing about that.
 */
export async function sendTo({ recipientId, text }, ctx) {
  const body = String(text ?? '').trim()
  if (!body) throw Object.assign(new Error('A message needs some text'), { statusCode: 400 })
  if (!recipientId) {
    throw Object.assign(new Error('No recipient for this conversation'), { statusCode: 400 })
  }

  const sent = await graph(`${ctx.userId}/messages`, {
    method: 'POST',
    params: {
      recipient: JSON.stringify({ id: String(recipientId) }),
      message: JSON.stringify({ text: body }),
    },
    token: ctx.token,
  })

  return sent.message_id ?? sent.id ?? null
}

/** Unanswered first, then most recent — the order the work should be done in. */
export const byUrgency = (a, b) => {
  if (a.answered !== b.answered) return a.answered ? 1 : -1
  return (b.lastAt ?? '').localeCompare(a.lastAt ?? '')
}
