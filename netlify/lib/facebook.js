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

  const who = person ? `This token belongs to ${person}, not to a Page. ` : ''

  /*
   * What can honestly be said stops here.
   *
   * This used to end "and that account administers no Facebook Page", which
   * the app has no way of knowing and which was flatly wrong for the first
   * person who hit it — he administers several. Facebook returning an empty
   * list is not the same fact: since granular Page consent, /me/accounts
   * contains only the Pages ticked in the login dialog, so a Page the user
   * owns is invisible here simply for not having been selected. Sending
   * someone off to "create a Page" they already have is worse than saying
   * nothing.
   */
  const couldNotAsk = scopes === null ? ' Facebook would not say which permissions it carries, either.' : ''

  const why = accountsError
    ? `Facebook would not list any Page for it: ${accountsError.message}`
    : 'Facebook returned an empty list of Pages for it.'

  return (
    `${who}${why}${couldNotAsk} ` +
    'That usually means the Page was not ticked when the token was authorised — the login dialog ' +
    'asks which Pages to allow, and only those come back. Generate the token again and select the ' +
    'Page there, or paste its Page ID into the field below so this app can ask for it by name.'
  )
}

/**
 * Asks for one Page by id, instead of looking for it in a list.
 *
 * Worth doing separately because the two are not equivalent. `/me/accounts`
 * is filtered by the Page selection made in the login dialog, so a Page can
 * be missing from it and still be perfectly reachable by id — and when it is
 * genuinely out of reach, Facebook's error on the node names the reason,
 * where the empty list said nothing at all.
 */
async function fetchPage(pageId, token) {
  // No `tasks` here: that field exists on the entries of /me/accounts and not
  // on the Page node, and asking for it makes Facebook reject the whole call
  // with "nonexisting field" — which read as the Page being unreachable.
  return fbGraph(String(pageId), {
    params: { fields: 'id,name,access_token' },
    token,
  })
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

  /**
   * A Page listed is not always a Page postable to. `tasks` says what this
   * person may do on it — an editor or moderator has no CREATE_CONTENT — and
   * without the check the channel connects happily and then refuses every
   * post, days later, with an error about permissions on an edge.
   */
  const usable = (page, fallbackToken = null) => {
    if (Array.isArray(page.tasks) && !page.tasks.includes('CREATE_CONTENT')) {
      throw fail(
        400,
        `You can see the Page "${page.name}" but not post to it — your role there is ${
          page.tasks.join(', ') || 'view only'
        }. Posting needs the "Create content" task, which a Page admin can grant.`
      )
    }

    // A Page's own token is preferred: it is what publishing needs and it
    // outlives the user token it came from. Asking for a Page by id does not
    // always return one, and then the token in hand is already the Page's.
    const token = page.access_token ?? fallbackToken
    if (!token) {
      throw fail(
        400,
        `Facebook described the Page "${page.name ?? pageId}" but gave no access token for it. ` +
          'Re-authorise the token with pages_manage_posts and select this Page in the dialog.'
      )
    }

    return { externalId: String(page.id), username: page.name ?? null, token }
  }

  /*
   * A named Page is looked for in two places, because the list is not the
   * whole truth: /me/accounts shows only the Pages ticked when the token was
   * authorised, while the Page node answers for any Page the token can reach.
   * Asking by id is what lets someone connect a Page the dialog left out —
   * the case that had this user stuck with a token that returned nothing.
   */
  if (pageId) {
    const listed = pages.find((page) => String(page.id) === String(pageId))
    if (listed) return usable(listed)

    let direct
    try {
      direct = await fetchPage(pageId, trimmed)
    } catch (error) {
      const list = pages.map((page) => `${page.name} (${page.id})`).join(', ')
      throw fail(
        error.statusCode === 401 ? 401 : 400,
        `This token cannot reach the Page ${pageId}: ${error.message}` +
          (list ? ` It does reach: ${list}.` : ' It lists no Pages at all.') +
          ' Generate the token again and tick this Page in the dialog that asks which Pages to allow.'
      )
    }

    return usable(direct, trimmed)
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
  // A photo story: the photo is uploaded unpublished and then handed to the
  // Page's photo_stories edge. Needs no permission beyond the ones a feed post
  // already does. Video stories use a resumable upload session and are not
  // built here.
  STORY: true,
  // A Reel on a Page is its own upload protocol. Refusing it plainly beats
  // sending a request Meta rejects with a message about a parameter the user
  // never saw.
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
  if (postType === 'STORY' && photos.length > 1) {
    throw fail(400, 'A Facebook story takes one photo')
  }
  if (photos.length > MAX_ATTACHED) {
    throw fail(400, `A Facebook post takes at most ${MAX_ATTACHED} photos`)
  }
  photos.forEach(requireHttps)

  if (postType === 'STORY') {
    // Unpublished first: a story is made from a photo that exists but is not a
    // post. Published, it would also land on the Page's feed, and Facebook
    // refuses a photo that has already been used in a published post.
    const photo = await fbGraph(`${ctx.userId}/photos`, {
      method: 'POST',
      params: { url: photos[0], published: false },
      token: ctx.token,
    })

    // A story carries no caption. Meta's story endpoint has no field for one.
    const story = await fbGraph(`${ctx.userId}/photo_stories`, {
      method: 'POST',
      params: { photo_id: photo.id },
      token: ctx.token,
    })

    if (!story.success && !story.post_id) throw fail(502, 'Facebook did not confirm the story')
    return story.post_id ?? photo.id
  }

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
