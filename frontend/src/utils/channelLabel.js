import { getPlatform } from '../data/platforms'

/**
 * How a channel is named where one gets picked.
 *
 * Usually just the handle. But a shop's Instagram account and its Facebook
 * Page routinely carry the same name — @sezalab and SeZaLab — and two chips
 * that read alike are two chips nobody can tell apart. Publishing to the wrong
 * one of those is not a small mistake: it goes out in front of the wrong
 * audience and deleting it afterwards does not unsend it.
 *
 * So the platform is spelled out, but only where there is something to tell
 * apart. Putting it on every chip would be noise on the usual setup where
 * every name is already distinct.
 */
export function channelLabel(account, all = []) {
  const handle = account.username ?? account.externalId
  const key = String(handle).toLowerCase()

  const ambiguous = all.some(
    (other) =>
      other.id !== account.id &&
      String(other.username ?? other.externalId).toLowerCase() === key
  )

  const platform = getPlatform(account.platform)
  return ambiguous ? `@${handle} · ${platform?.name ?? account.platform}` : `@${handle}`
}

/**
 * A channel with its platform spelled out, always.
 *
 * `channelLabel` names the platform only when two channels would otherwise read
 * alike. In a row of filter buttons that is not enough: the icon is the only
 * other clue, and a camera and a thumbs-up do not say "Instagram" and
 * "Facebook" to anyone who has not memorised them. Where the buttons are what
 * a person scans to pick a channel, the platform is written out every time.
 */
export function channelWithPlatform(account) {
  const handle = account.username ?? account.externalId
  const platform = getPlatform(account.platform)
  return platform ? `@${handle} · ${platform.name}` : `@${handle}`
}
