import { api } from './api'

/**
 * Normalises a user-picked file into something Instagram will accept.
 *
 * Instagram's content-publishing API takes JPEG only — a PNG or WebP upload is
 * rejected at publish time, long after the user thinks it worked. Converting in
 * the browser fixes that for free: no server round-trip, no image library, no
 * per-image cost. Downscaling at the same time keeps uploads small.
 */

// Instagram renders feed images at 1080px wide; anything beyond 1440 is wasted bytes.
const MAX_WIDTH = 1440
const QUALITY = 0.9

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable'))
    }
    img.src = url
  })
}

/**
 * @returns {Promise<{ blob: Blob, width: number, height: number, previewUrl: string }>}
 */
export async function prepareImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('not-an-image')
  }

  const img = await loadImage(file)

  const scale = Math.min(1, MAX_WIDTH / img.naturalWidth)
  const width = Math.round(img.naturalWidth * scale)
  const height = Math.round(img.naturalHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  // Transparent PNGs would otherwise flatten to black once encoded as JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('encode-failed'))),
      'image/jpeg',
      QUALITY
    )
  })

  return { blob, width, height, previewUrl: URL.createObjectURL(blob) }
}

/**
 * Instagram rejects feed images outside roughly 4:5 (portrait) to 1.91:1
 * (landscape). Checking here lets the UI warn before an upload is wasted.
 */
export function aspectWarning(width, height) {
  const ratio = width / height
  if (ratio < 0.8) return 'too-tall'
  if (ratio > 1.91) return 'too-wide'
  return null
}

/** Uploads through a presigned URL and returns the public URL Instagram will fetch. */
export async function uploadToStorage(blob) {
  // Asking for the presigned URL goes through our own API, so it carries the
  // app password. The upload itself must not: it goes to Cloudflare, the URL's
  // signature is its authorisation, and an extra header would both leak the
  // password to a third party and break the signature.
  const presign = await api('upload-url', { body: { size: blob.size } })

  let putResponse
  try {
    putResponse = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: presign.headers,
      body: blob,
    })
  } catch (error) {
    // The browser reports a blocked cross-origin request and a dead network the
    // same way: a bare TypeError with nothing in it. CORS is much the commoner
    // cause — it is what happens the first time a site moves off localhost —
    // but it cannot be read off the failure, so this says which is likely
    // rather than asserting one, and carries the browser's own words along.
    throw Object.assign(
      new Error(`storage-blocked:${window.location.origin}:${error.message}`),
      { code: 'storage-blocked', origin: window.location.origin, cause: error }
    )
  }

  if (!putResponse.ok) {
    throw new Error(`Upload rejected by storage (HTTP ${putResponse.status})`)
  }

  return presign.publicUrl
}
