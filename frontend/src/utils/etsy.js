import { api } from './api'

/** The shop's live listings, newest first. */
export const fetchListings = (limit) =>
  api('etsy-listings', { method: 'GET', query: limit ? { limit } : undefined })

// Instagram cuts a caption off after this many characters; the first two lines
// are all most people see before "more".
const MAX_CAPTION = 2200

// Enough tags to be found, few enough to not read as spam.
const MAX_TAGS = 12

/** "€24.00" — the shop's own currency, formatted for the reader's locale. */
export function formatPrice(price, locale) {
  if (!price?.amount) return null
  try {
    return price.currency
      ? price.amount.toLocaleString(locale, { style: 'currency', currency: price.currency })
      : price.amount.toLocaleString(locale)
  } catch {
    // An unknown currency code must not take the whole card down with it.
    return `${price.amount} ${price.currency ?? ''}`.trim()
  }
}

/** "Hand-poured soy candle" from a tag like "hand poured soy candle". */
const hashtag = (tag) =>
  `#${tag
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')}`

/**
 * The opening of a listing description, without the boilerplate that follows.
 *
 * Etsy descriptions run long and usually end in shipping terms and returns
 * policy, which is the last thing a caption should carry. The first paragraph
 * is where sellers put the actual pitch.
 */
function opening(description) {
  const first = String(description ?? '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find(Boolean)

  if (!first) return ''
  // A single very long paragraph gets cut at a sentence rather than mid-word.
  if (first.length <= 400) return first
  const cut = first.slice(0, 400)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return stop > 150 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`
}

/**
 * A caption drafted from what the seller already wrote.
 *
 * Their words, not invented ones: the title, the opening of their own
 * description, their own price and their own tags. Nothing here claims
 * anything about the product that the listing does not already say — which is
 * the whole reason to build it from the listing rather than from the photo.
 *
 * It is a draft. The Create screen puts it in an editable box, and the AI
 * button is still there for anyone who wants it rewritten.
 */
export function draftCaption(listing, { locale = 'en-US', linkLabel } = {}) {
  const price = formatPrice(listing.price, locale)
  const body = opening(listing.description)

  const tags = (listing.tags ?? [])
    .slice(0, MAX_TAGS)
    .map(hashtag)
    .filter((tag) => tag.length > 2)

  const parts = [
    listing.title?.trim(),
    body && body !== listing.title?.trim() ? body : null,
    price,
    // Instagram makes no link in a caption clickable. Saying where it is beats
    // pasting a URL that looks tappable and is not.
    listing.url ? `${linkLabel ?? 'Etsy'}: ${listing.url}` : null,
    tags.length ? tags.join(' ') : null,
  ].filter(Boolean)

  return parts.join('\n\n').slice(0, MAX_CAPTION)
}

/** What the AI caption writer should be told about, when asked to rewrite. */
export const topicFor = (listing) =>
  [listing.title, (listing.tags ?? []).slice(0, MAX_TAGS).join(', ')]
    .filter(Boolean)
    .join(' — ')
