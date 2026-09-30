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
/** Which permissions the token was actually granted, for the failure message. */
async function grantedScopes(token) {
  try {
    const { data } = await fbGraph('me/permissions', { token })
    return (data ?? [])
      .filter((row) => row.status === 'granted')
      .map((row) => row.permission)
  } catch {
    // The token is too broken to ask. The caller has a message either way.
    return null
  }
}

const NEEDED = ['pages_show_list', 'pages_manage_posts']

/**
 * Says why no Page could be connected, precisely enough to act on.
 *
 * This used to relay whatever Facebook said, which for the usual mistakes is
 * unhelpful to the point of being misleading — "Invalid OAuth access token"
 * is the same sentence for an expired token, an Instagram token, and a token
 * from the wrong app. The three fixes are completely different, so the message
 * names which one it is.
 */
async function diagnose({ token, person, accountsError }) {
  const scopes = await grantedScopes(token)
  const missing = scopes ? NEEDED.filter((scope) => !scopes.includes(scope)) : []

  if (missing.length) {
    return (
      `This token is missing ${missing.join(' and ')}. ` +
      `It currently has: ${scopes.length ? scopes.join(', ') : 'nothing'}. ` +
      'Generate it again in the Graph API Explorer with those permissions ticked.'
    )
  }

  if (person) {
    return (
      `This token belongs to ${person}, not to a Page, and that account administers no Facebook Page. ` +
      'A Page is what this app posts to — an Instagram business account is not one. ' +
      'Create a Page, or use a token from an account that already administers one.'
    )
  }

  return accountsError
    ? `Facebook would not list any Page for this token: ${accountsError.message}`
    : 'Facebook listed no Page for this token.'
}

export async function identifyPage(token, pageId = null) {
  const trimmed = String(token ?? '').trim()
  if (trimmed.length < 20) throw fail(400, 'That does not look like an access token')

  // The likeliest mistake, and the one Facebook answers most obscurely: an
  // Instagram Login token pasted into the Facebook form. It is not a Facebook
  // token at all, and graph.facebook.com replies "Cannot parse access token",
  // which reads like the token was mistyped.
  if (/^IGQ/i.test(trimmed)) {
    throw fail(
      400,
      'That is an Instagram token — it starts with "IGQ". A Facebook Page needs a Facebook token ' +
        '(it starts with "EAA"), generated under Facebook Login or in the Graph API Explorer.'
    )
  }

  let pages = []
  let accountsError = null
  try {
    const mine = await fbGraph('me/accounts', {
      params: { fields: 'id,name,access_token,tasks' },
      token: trimmed,
    })
    pages = mine.data ?? []
  } catch (error) {
    // Kept, not swallowed. A Page token genuinely cannot list accounts, so
    // this is not always a failure — but when nothing else works out it is
    // the only thing that knows why.
    accountsError = error
  }

  if (pages.length === 0) {
    let me
    try {
      // `category` exists on a Page and not on a person, which is what tells
      // a Page token from a user token holding no Pages.
      me = await fbGraph('me', { params: { fields: 'id,name,category' }, token: trimmed })
    } catch (error) {
      me = null
    }

    if (me?.id && me.category) {
      return { externalId: String(me.id), username: me.name ?? null, token: trimmed }
    }

    // Not a Page. Before this returned it anyway — storing a person's own
    // profile as a "Facebook channel", which then failed at publishing time
    // with an error about a photos edge the user never asked for.
    let person = null
    try {
      const who = await fbGraph('me', { params: { fields: 'id,name' }, token: trimmed })
      person = who.name ?? who.id ?? null
    } catch (error) {
      throw fail(401, `Facebook rejected this token: ${error.message}`)
    }

    throw fail(400, await diagnose({ token: trimmed, person, accountsError }))
  }

  /**
   * A Page listed is not always a Page postable to. `tasks` says what this
   * person may do on it — an editor or moderator has no CREATE_CONTENT — and
   * without the check the channel connects happily and then refuses every
   * post, days later, with an error about permissions on an edge.
   */
  const usable = (page) => {
    if (Array.isArray(page.tasks) && !page.tasks.includes('CREATE_CONTENT')) {
      throw fail(
        400,
        `You can see the Page "${page.name}" but not post to it — your role there is ${
          page.tasks.join(', ') || 'view only'
        }. Posting needs the "Create content" task, which a Page admin can grant.`
      )
    }
    return { externalId: String(page.id), username: page.name ?? null, token: page.access_token }
  }

  if (pageId) {
    const chosen = pages.find((page) => String(page.id) === String(pageId))
    if (!chosen) {
      const list = pages.map((page) => `${page.name} (${page.id})`).join(', ')
      throw fail(400, `This token has no Page with id ${pageId}. It manages: ${list || 'none'}.`)
    }
    return usable(chosen)
  }

  if (pages.length > 1) {
    const list = pages.map((page) => `${page.name} (${page.id})`).join(', ')
    throw fail(
      400,
      `This token manages several Pages: ${list}. Add the Page id as well so the right one is connected.`
    )
  }

  // One Page, and `usable` hands back its own token rather than the user's:
  // that is what publishing needs, and it outlives the token it came from.
  const [only] = pages
  return usable(only)
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
