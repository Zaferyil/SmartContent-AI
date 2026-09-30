/**
 * Publishing to a Facebook Page.
 *
 * Deliberately not folded into the Instagram library. The two look alike from
 * the outside and are not alike underneath: Instagram builds a media container
 * and publishes it in a second step, and a Page takes the photo and posts it in
 * one. Sharing the code would mean a switch in every function for no reuse.
 *
 * One thing worth knowing before reading further: while the Meta app is in
 * Development mode, a post made here is created but shown only to people with
 * a role on the app or the Page. It is not a silent failure — the post exists
 * and carries an id — but nobody else can see it until the app is Live.
 */

const API_VERSION = process.env.FB_API_VERSION || 'v23.0'
const HOST = 'https://graph.facebook.com'

// Meta's ceiling for the photos attached to one feed post.
const MAX_ATTACHED = 10
const MAX_MESSAGE = 63206

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode })

/** Calls the Graph API and turns Meta's error envelope into a real Error. */
export async function fbGraph(path, { method = 'GET', params = {}, token } = {}) {
  const url = new URL(`${HOST}/${API_VERSION}/${path}`)
  const payload = { ...params, access_token: token }

  let response
  if (method === 'GET') {
    Object.entries(payload).forEach(([k, v]) => url.searchParams.set(k, v))
    response = await fetch(url)
  } else {
    response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload),
    })
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.error) {
    const meta = data.error || {}
    const error = new Error(meta.message || `Facebook API error (HTTP ${response.status})`)
    error.statusCode = response.status === 200 ? 502 : response.status
    error.metaCode = meta.code
    error.metaSubcode = meta.error_subcode
    throw error
  }

  return data
}

/**
 * Works out which Page a pasted token belongs to.
 *
 * Two kinds of token arrive here and they behave differently, so both are
 * handled rather than one being documented and the other failing obscurely:
 *
 *   a Page token  — /me is the Page itself
 *   a User token  — /me is the person, and /me/accounts lists their Pages,
 *                   each with its own Page token, which is what gets stored
 *
 * With several Pages and no `pageId` this refuses and names them. Guessing
 * would mean publishing to whichever Page happened to be first, in front of an
 * audience the user did not choose — the one mistake here that cannot be
 * undone by deleting a post.
 */
export async function identifyPage(token, pageId = null) {
  const trimmed = String(token ?? '').trim()
  if (trimmed.length < 20) throw fail(400, 'That does not look like an access token')

  let pages = []
  try {
    const mine = await fbGraph('me/accounts', {
      params: { fields: 'id,name,access_token,tasks' },
      token: trimmed,
    })
    pages = mine.data ?? []
  } catch (error) {
    // A Page token cannot list accounts. That is not a failure, it just means
    // we are already holding the Page, which /me below will confirm.
    pages = []
  }

  if (pages.length === 0) {
    let me
    try {
      me = await fbGraph('me', { params: { fields: 'id,name' }, token: trimmed })
    } catch (error) {
      throw fail(401, `Facebook rejected this token: ${error.message}`)
    }

    if (!me.id) throw fail(400, 'Facebook did not return a Page for this token')

    // A user token with no Pages reaches here too, and /me is the person, not
    // a Page. Publishing to a person's own timeline is not what this app is
    // for, and Meta no longer allows it from an app anyway.
    return { externalId: String(me.id), username: me.name ?? null, token: trimmed }
  }

  if (pageId) {
    const chosen = pages.find((page) => String(page.id) === String(pageId))
    if (!chosen) {
      throw fail(400, `This token has no Page with id ${pageId}.`)
    }
    return { externalId: String(chosen.id), username: chosen.name ?? null, token: chosen.access_token }
  }

  if (pages.length > 1) {
    const list = pages.map((page) => `${page.name} (${page.id})`).join(', ')
    throw fail(
      400,
      `This token manages several Pages: ${list}. Add the Page id as well so the right one is connected.`
    )
  }

  const [only] = pages
  // The Page's own token, not the user's: it is what publishing needs, and it
  // outlives the user token it came from.
  return { externalId: String(only.id), username: only.name ?? null, token: only.access_token }
}

/** What this app can put on a Page, and what it cannot. */
export const FB_POST_TYPES = {
  FEED: true,
  CAROUSEL: true,
  // Stories and Reels on a Page are separate APIs with their own upload
  // protocols. Refusing them plainly beats sending a request Meta rejects with
  // a message about a parameter the user never saw.
  STORY: false,
  REELS: false,
}

const requireHttps = (url) => {
  if (!/^https:\/\//i.test(url ?? '')) {
    throw fail(400, 'Media URL must be publicly reachable over HTTPS')
  }
}

/**
 * Posts to the Page and returns the id of what was created.
 *
 * A single photo goes to /photos in one request. Several become unpublished
 * photos first and then one feed post that attaches them — which is how a Page
 * shows a set of images as one story rather than as a burst of separate posts.
 */
export async function publishToPage({ imageUrl, imageUrls, caption = '', postType = 'FEED' }, ctx) {
  if (!FB_POST_TYPES[postType]) {
    throw fail(400, `Facebook Pages cannot take a ${postType} post from this app yet.`)
  }
  if (caption.length > MAX_MESSAGE) {
    throw fail(400, `Text exceeds the ${MAX_MESSAGE} character limit`)
  }

  const many = postType === 'CAROUSEL'
  const photos = many ? (Array.isArray(imageUrls) ? imageUrls : []) : [imageUrl].filter(Boolean)

  if (photos.length === 0) throw fail(400, `${postType} needs an image`)
  if (photos.length > MAX_ATTACHED) {
    throw fail(400, `A Facebook post takes at most ${MAX_ATTACHED} photos`)
  }
  photos.forEach(requireHttps)

  if (!many) {
    const posted = await fbGraph(`${ctx.userId}/photos`, {
      method: 'POST',
      // `caption` is what /photos calls its text; /feed calls the same thing
      // `message`. Sending the wrong one posts an image with no words.
      params: { url: photos[0], caption },
      token: ctx.token,
    })
    return posted.post_id ?? posted.id
  }

  const uploaded = await Promise.all(
    photos.map((url) =>
      fbGraph(`${ctx.userId}/photos`, {
        method: 'POST',
        params: { url, published: false },
        token: ctx.token,
      })
    )
  )

  const post = await fbGraph(`${ctx.userId}/feed`, {
    method: 'POST',
    params: {
      message: caption,
      // Order matters: it is the order they appear in.
      attached_media: JSON.stringify(uploaded.map((photo) => ({ media_fbid: photo.id }))),
    },
    token: ctx.token,
  })

  return post.id
}
