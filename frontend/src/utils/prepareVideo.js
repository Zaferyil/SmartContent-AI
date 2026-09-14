/**
 * Checks a user-picked video against what Instagram publishes as its Reel
 * specification, before a single byte is uploaded.
 *
 * Nothing is converted here. Re-encoding video in a browser means shipping a
 * transcoder and minutes of work on the user's machine, and the file the user
 * exported from their phone or editor is already what Instagram wants. So this
 * only measures — and the point of measuring is that a 300 MB upload followed
 * by a rejection at publish time is a long, silent way to waste someone's
 * evening.
 *
 * Source: Meta's "Reel Specifications" table.
 * https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
 */

export const REEL = {
  // The container formats Meta lists. A .mov file arrives as video/quicktime.
  types: ['video/mp4', 'video/quicktime'],
  accept: 'video/mp4,video/quicktime,.mp4,.mov',
  maxBytes: 300 * 1024 * 1024,
  minSeconds: 3,
  maxSeconds: 15 * 60,
  // Meta's hard range is 0.01:1 to 10:1; 9:16 is what it recommends.
  maxWidth: 1920,
}

/** Reads what the browser can tell us about a video file without decoding it all. */
function readMetadata(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    // Muted + playsInline so no browser refuses to load metadata for a video
    // that was never going to be played here anyway.
    video.muted = true
    video.playsInline = true

    const done = (meta) => {
      video.onloadedmetadata = null
      video.onerror = null
      resolve({ ...meta, previewUrl: url })
    }

    video.onloadedmetadata = () =>
      done({
        // A stream with no duration in its header reports Infinity.
        duration: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      })

    // Not a failure. A browser that cannot decode this codec — HEVC outside
    // Safari, most often — still uploads the file perfectly well, and refusing
    // it here would block a video Instagram would have accepted. So the checks
    // below are skipped and the note says they were.
    video.onerror = () => done({ duration: null, width: null, height: null })

    video.src = url
  })
}

const fail = (code) => Object.assign(new Error(code), { code })

/**
 * @returns {Promise<{file: File, contentType: string, duration: ?number,
 *                    width: ?number, height: ?number, previewUrl: string,
 *                    warning: ?string}>}
 * @throws  an Error whose `code` names which rule the file broke, so the caller
 *          can say it in the user's language.
 */
export async function prepareVideo(file) {
  if (!REEL.types.includes(file.type)) throw fail('not-a-video')
  if (file.size > REEL.maxBytes) throw fail('video-too-large')

  const meta = await readMetadata(file)

  // Only reject on a measurement we actually have. An unreadable header is
  // reported, not treated as a violation.
  if (meta.duration !== null) {
    if (meta.duration < REEL.minSeconds) {
      URL.revokeObjectURL(meta.previewUrl)
      throw fail('video-too-short')
    }
    if (meta.duration > REEL.maxSeconds) {
      URL.revokeObjectURL(meta.previewUrl)
      throw fail('video-too-long')
    }
  }

  return { file, contentType: file.type, ...meta, warning: warningFor(meta) }
}

/** Things Instagram accepts but will not show the way the user expects. */
function warningFor({ duration, width, height }) {
  if (duration === null) return 'video-unreadable'
  if (!width || !height) return null
  if (width > REEL.maxWidth) return 'video-too-wide'
  // Anything not taller than it is wide gets bars or a crop in a 9:16 frame.
  if (width >= height) return 'video-not-vertical'
  return null
}

/**
 * "1:24" — the one number a reel is judged by.
 *
 * Truncated rather than rounded, because the player sitting directly above this
 * line truncates, and two different lengths for the same video reads as a bug.
 */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return null
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** "42,8 MB" in the user's locale. */
export function formatSize(bytes, locale) {
  return `${(bytes / 1024 / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`
}
