import { readDoc, updateDoc } from './store.js'

const KEY = 'settings'
const ID = 'publishing'

/**
 * Publishing preferences.
 *
 * The timezone is the one thing here the publisher cannot guess: it stores
 * instants, so it never needs a zone itself, but every time the user *types*
 * ("09:00") has to be read in some zone, and the browser's own is wrong as soon
 * as they travel. Keeping it explicit means a plan made in Vienna still goes
 * out at Vienna breakfast time from a laptop in another country.
 */
const DEFAULTS = {
  timezone: 'Europe/Vienna',
  postsPerDay: 3,
  preferredTimes: ['09:00', '13:00', '18:30'],
  /**
   * Which channel the Create screen starts on.
   *
   * Null means "the first one", which is a fair guess only while there is one.
   * With several, "first" is whichever happens to sort first — so the channel
   * someone actually posts to most is named here rather than guessed at, and
   * never written into the code.
   */
  defaultAccountId: null,
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 })

export async function readSettings() {
  const { items } = await readDoc(KEY)
  const stored = items.find((item) => item.id === ID)
  return { ...DEFAULTS, ...(stored ?? {}), id: ID }
}

export async function writeSettings(input) {
  const next = await readSettings()

  if (input.timezone !== undefined) {
    try {
      // Throws RangeError on an unknown zone, which is exactly the check we want.
      new Intl.DateTimeFormat('en', { timeZone: String(input.timezone) })
    } catch {
      throw badRequest(`Unknown timezone "${input.timezone}"`)
    }
    next.timezone = String(input.timezone)
  }

  if (input.postsPerDay !== undefined) {
    const n = Number(input.postsPerDay)
    if (!Number.isInteger(n) || n < 1 || n > 12) {
      throw badRequest('postsPerDay must be a whole number between 1 and 12')
    }
    next.postsPerDay = n
  }

  if (input.preferredTimes !== undefined) {
    if (!Array.isArray(input.preferredTimes) || input.preferredTimes.length === 0) {
      throw badRequest('preferredTimes must be a non-empty list')
    }
    for (const time of input.preferredTimes) {
      if (!HHMM.test(String(time))) throw badRequest(`"${time}" is not a HH:MM time`)
    }
    next.preferredTimes = [...new Set(input.preferredTimes.map(String))].sort()
  }

  // Not checked against the account list on purpose: settings and accounts are
  // separate documents, and a channel removed later would otherwise have to
  // reach in here to tidy up. The Create screen ignores an id it cannot find
  // and falls back, which is the same outcome with less coupling.
  if (input.defaultAccountId !== undefined) {
    next.defaultAccountId = input.defaultAccountId ? String(input.defaultAccountId) : null
  }

  await updateDoc(KEY, (items) => [...items.filter((item) => item.id !== ID), next])
  return next
}
