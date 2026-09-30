/**
 * Reads a shop's live listings from the Etsy Open API v3.
 *
 * Read-only and deliberately so. Everything here uses endpoints whose whole
 * authentication is the app keystring — Etsy's spec marks the API globally as
 * `api_key` and only overrides individual operations with `oauth2`. The two
 * used below carry no such override, so there is no OAuth redirect, no refresh
 * token and no consent screen to maintain. (getListingsByShop, the one that can
 * also see drafts, does require oauth2 listings_r — which is exactly why this
 * asks for the active ones instead.)
 *
 * Nothing here can change the shop. The keystring stays on the server; the
 * browser never sees it.
 */

const BASE = 'https://openapi.etsy.com/v3/application'

const CONFIG_VARS = {
  apiKey: 'ETSY_API_KEY',
  shopName: 'ETSY_SHOP_NAME',
}

// Etsy caps a page at 100, and asking for the maximum means a shop of ordinary
// size arrives in one round trip and can be ordered exactly (see `listActive`).
const PAGE = 100

// Meta's ceiling for a carousel, which is what several listing photos become.
const MAX_IMAGES = 10

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode })

export function requireConfig() {
  const config = {}
  const missing = []

  for (const [field, envName] of Object.entries(CONFIG_VARS)) {
    const value = process.env[envName]?.trim()
    if (value) config[field] = value
    else missing.push(envName)
  }

  if (missing.length) {
    throw fail(
      500,
      `Etsy is not configured. Missing environment variables: ${missing.join(', ')}. ` +
        'Register a Seller App at etsy.com/developers to get the keystring.'
    )
  }

  // A shop URL pasted whole instead of the name. Cheap to accept, and the
  // alternative is a 404 from a search for "https://www.etsy.com/shop/SeZaLab".
  const fromUrl = config.shopName.match(/etsy\.com\/[a-z-]*\/?shop\/([^/?#]+)/i)
  if (fromUrl) config.shopName = fromUrl[1]

  return config
}

async function etsy(path, { params = {}, apiKey }) {
  const url = new URL(`${BASE}/${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  })

  const response = await fetch(url, { headers: { 'x-api-key': apiKey } })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    // Etsy answers an unapproved or mistyped key with 401/403 and a bare
    // string, which on its own reads like a bug in this app.
    const detail = data.error || data.message || `HTTP ${response.status}`
    if (response.status === 401 || response.status === 403) {
      throw fail(
        response.status,
        `Etsy refused the API key (${detail}). Check ETSY_API_KEY, and that the app is approved in Your Apps on etsy.com.`
      )
    }
    throw fail(response.status === 404 ? 404 : 502, `Etsy: ${detail}`)
  }

  return data
}

// Resolving the name costs a request, and the id never changes. Module scope
// survives between invocations of a warm function, so most calls skip it.
let cachedShop = null

export async function resolveShop({ apiKey, shopName }) {
  if (cachedShop?.shop_name?.toLowerCase() === shopName.toLowerCase()) return cachedShop

  const found = await etsy('shops', { params: { shop_name: shopName, limit: PAGE }, apiKey })

  // findShops is a search, not a lookup: it returns anything that resembles the
  // name. Taking results[0] would happily hand back somebody else's shop.
  const exact = (found.results ?? []).find(
    (shop) => shop.shop_name?.toLowerCase() === shopName.toLowerCase()
  )
  if (!exact) {
    throw fail(404, `No Etsy shop is named "${shopName}". Check ETSY_SHOP_NAME.`)
  }

  cachedShop = exact
  return exact
}

/** The images Instagram will fetch, largest first, capped at what a carousel takes. */
const imagesOf = (listing) =>
  (listing.images ?? [])
    .slice()
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .slice(0, MAX_IMAGES)
    .map((image) => ({
      url: image.url_fullxfull,
      thumbnail: image.url_570xN ?? image.url_fullxfull,
      width: image.full_width ?? null,
      height: image.full_height ?? null,
      alt: image.alt_text ?? null,
    }))
    .filter((image) => image.url)

const money = (price) =>
  price?.amount && price?.divisor
    ? { amount: price.amount / price.divisor, currency: price.currency_code ?? null }
    : null

/**
 * The shop's live listings, newest first.
 *
 * Ordered here rather than by the API: Etsy's own `sort_on` documents itself as
 * working only alongside a search term, so asking for it without keywords is
 * asking for an order it does not promise. `created_timestamp` comes back on
 * every listing, so sorting on that is exact — as long as the whole shop fits
 * in one page, which is what `total` is reported for.
 */
export async function listActive({ limit = 24 } = {}) {
  const config = requireConfig()
  const shop = await resolveShop(config)

  const page = await etsy(`shops/${shop.shop_id}/listings/active`, {
    params: { limit: PAGE },
    apiKey: config.apiKey,
  })

  const all = page.results ?? []
  const newest = all
    .slice()
    .sort((a, b) => (b.created_timestamp ?? 0) - (a.created_timestamp ?? 0))
    .slice(0, limit)

  // One request for every listing's images would be one request per card. The
  // batch endpoint takes the ids and the images together.
  const withImages = newest.length
    ? await etsy('listings/batch', {
        params: {
          listing_ids: newest.map((l) => l.listing_id).join(','),
          includes: 'Images',
        },
        apiKey: config.apiKey,
      })
    : { results: [] }

  const byId = new Map((withImages.results ?? []).map((l) => [l.listing_id, l]))

  return {
    shop: { id: shop.shop_id, name: shop.shop_name, url: shop.url ?? null },
    total: page.count ?? all.length,
    // Says plainly when the shop is larger than one page, because then "newest"
    // is newest among what was read, not newest in the shop.
    complete: all.length >= (page.count ?? all.length),
    listings: newest.map((listing) => {
      const full = byId.get(listing.listing_id) ?? listing
      return {
        id: listing.listing_id,
        title: listing.title ?? '',
        description: listing.description ?? '',
        url: listing.url ?? null,
        price: money(listing.price),
        tags: Array.isArray(listing.tags) ? listing.tags : [],
        materials: Array.isArray(listing.materials) ? listing.materials : [],
        createdAt: listing.created_timestamp
          ? new Date(listing.created_timestamp * 1000).toISOString()
          : null,
        favorers: listing.num_favorers ?? 0,
        images: imagesOf(full),
      }
    }),
  }
}
