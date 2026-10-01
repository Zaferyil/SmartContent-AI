/**
 * Publishing to a Pinterest board.
 *
 * A Pin is not a post on a profile: it always lives on a board, and the board
 * is what a channel is here. So the stored `externalId` is the board id, and
 * connecting asks which board the token should post to rather than guessing —
 * pinning to the wrong board is visible to followers of that board and has no
 * undo short of deleting the Pin.
 *
 * Endpoint shapes were read from Pinterest's published OpenAPI description
 * (v5): POST /pins needs `boards:read` and `pins:write`; `title` is capped at
 * 100 characters, `description` at 800, and a multi-image Pin takes 2 to 5.
 */

const HOST = process.env.PINTEREST_API_HOST || 'https://api.pinterest.com/v5'

const MAX_TITLE = 100
const MAX_DESCRIPTION = 800
const MIN_IMAGES = 2
const MAX_IMAGES = 5

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode })

/** Calls the Pinterest API and turns its error body into a real Error. */
export async function pinGraph(path, { method = 'GET', params = {}, body, token } = {}) {
  const url = new URL(`${HOST}/${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data.message || `Pinterest API error (HTTP ${response.status})`)
    error.statusCode = response.status
    error.pinterestCode = data.code
    throw error
  }

  return data
}

/** Every board the token can post to, following Pinterest's bookmark paging. */
async function listBoards(token) {
  const boards = []
  let bookmark

  // Bounded: a runaway cursor must not turn a form submit into an endless loop.
  for (let page = 0; page < 10; page++) {
    const result = await pinGraph('boards', {
      params: { page_size: 100, ...(bookmark ? { bookmark } : {}) },
      token,
    })
    boards.push(...(result.items ?? []))
    bookmark = result.bookmark
    if (!bookmark) break
  }

  return boards
}

/**
 * Works out which board a pasted token should post to.
 *
 * Listing boards doubles as the validity check, the same way asking Instagram
 * who a token is does: a token that cannot see its own boards cannot create a
 * Pin on one either.
 */
export async function identifyBoard(token, boardId = null) {
  const trimmed = String(token ?? '').trim()
  if (trimmed.length < 20) throw fail(400, 'That does not look like an access token')

  let boards
  try {
    boards = await listBoards(trimmed)
  } catch (error) {
    if (error.statusCode === 401) {
      throw fail(
        401,
        `Pinterest rejected this token: ${error.message} It may have expired — generate a new one in your Pinterest app.`
      )
    }
    if (error.statusCode === 403) {
      throw fail(
        403,
        `This token cannot read boards: ${error.message} Generate it with the boards:read and pins:write scopes.`
      )
    }
    throw fail(error.statusCode || 502, `Pinterest would not list boards for this token: ${error.message}`)
  }

  if (boards.length === 0) {
    throw fail(
      400,
      'This token sees no boards. Create a board on Pinterest first — a Pin has to be saved to one. ' +
        'Secret boards are not listed unless the token also has the boards:read_secret scope.'
    )
  }

  // Which account it is, for the label. Optional: it needs a scope the posting
  // itself does not, so being refused it must not stop the connection.
  let owner = null
  try {
    const me = await pinGraph('user_account', { token: trimmed })
    owner = me.username ?? null
  } catch {
    owner = null
  }

  const describe = (board) => `${board.name} (${board.id})`

  let chosen
  if (boardId) {
    chosen = boards.find((board) => String(board.id) === String(boardId).trim())
    if (!chosen) {
      throw fail(
        400,
        `This token has no board with id ${boardId}. It sees: ${boards.map(describe).join(', ')}.`
      )
    }
  } else if (boards.length === 1) {
    chosen = boards[0]
  } else {
    throw fail(
      400,
      `This token sees several boards: ${boards.map(describe).join(', ')}. ` +
        'Add the board id as well so the right one is connected.'
    )
  }

  return {
    externalId: String(chosen.id),
    username: owner ? `${chosen.name} · ${owner}` : chosen.name,
    accountType: 'BOARD',
    token: trimmed,
  }
}

/** What this app can put on a board, and what it cannot. */
export const PIN_POST_TYPES = {
  FEED: true,
  CAROUSEL: true,
  // A Pin has no story or reel form; video Pins use a separate upload flow.
  STORY: false,
  REELS: false,
}

export const PIN_MAX_IMAGES = MAX_IMAGES

const requireHttps = (url) => {
  if (!/^https:\/\//i.test(url ?? '')) {
    throw fail(400, 'Media URL must be publicly reachable over HTTPS')
  }
}

/**
 * Splits the one caption this app has into the two fields a Pin has.
 *
 * The title is the first line, shortened at a word where it can be; the
 * description is the whole caption, so nothing the user wrote is lost to the
 * split. Both are cut to Pinterest's limits here because it rejects an
 * over-long field outright rather than trimming it.
 */
export function pinText(caption = '') {
  const text = String(caption).trim()
  const firstLine = text.split('\n')[0].trim()

  let title = firstLine
  if (title.length > MAX_TITLE) {
    const cut = title.slice(0, MAX_TITLE - 1)
    const space = cut.lastIndexOf(' ')
    title = `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`
  }

  const description = text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : text

  return { title, description }
}

/** Creates the Pin and returns its id. */
export async function publishToBoard({ imageUrl, imageUrls, caption = '', postType = 'FEED' }, ctx) {
  if (!PIN_POST_TYPES[postType]) {
    throw fail(400, `Pinterest cannot take a ${postType} post from this app.`)
  }

  const many = postType === 'CAROUSEL'
  const photos = many ? (Array.isArray(imageUrls) ? imageUrls : []) : [imageUrl].filter(Boolean)

  if (photos.length === 0) throw fail(400, `${postType} needs an image`)
  if (many && photos.length < MIN_IMAGES) {
    throw fail(400, `A Pinterest carousel needs at least ${MIN_IMAGES} images`)
  }
  if (photos.length > MAX_IMAGES) {
    throw fail(400, `A Pinterest carousel takes at most ${MAX_IMAGES} images`)
  }
  photos.forEach(requireHttps)

  const { title, description } = pinText(caption)

  const media_source = many
    ? { source_type: 'multiple_image_urls', items: photos.map((url) => ({ url })) }
    : { source_type: 'image_url', url: photos[0] }

  const pin = await pinGraph('pins', {
    method: 'POST',
    body: {
      board_id: String(ctx.userId),
      media_source,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    },
    token: ctx.token,
  })

  if (!pin.id) throw fail(502, 'Pinterest did not return a Pin id')
  return String(pin.id)
}
