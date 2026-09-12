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
export async function uploadToStorage(blob, { endpoint = '/.netlify/functions/upload-url' } = {}) {
  const presignResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ size: blob.size }),
  })

  const presign = await presignResponse.json()
  if (!presignResponse.ok) throw new Error(presign.error || 'Could not prepare the upload')

  const putResponse = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: presign.headers,
    body: blob,
  })

  if (!putResponse.ok) {
    throw new Error(`Upload rejected by storage (HTTP ${putResponse.status})`)
  }

  return presign.publicUrl
}
