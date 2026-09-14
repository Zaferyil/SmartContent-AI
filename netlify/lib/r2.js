import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'

/**
 * The object store, in one place.
 *
 * Two functions now reach for these credentials — the one that hands out upload
 * URLs and the one that removes a video once Instagram has taken its own copy —
 * and a second spelling of the same configuration is how the two drift.
 */

export const CONFIG_VARS = {
  accountId: 'R2_ACCOUNT_ID',
  accessKeyId: 'R2_ACCESS_KEY_ID',
  secretAccessKey: 'R2_SECRET_ACCESS_KEY',
  bucket: 'R2_BUCKET',
  publicBase: 'R2_PUBLIC_BASE_URL',
}

// A Cloudflare account id is a 32-character hex string. Anything else — most
// easily the bucket name, which sits right next to it in the R2 dashboard —
// builds a hostname that does not resolve. The browser then reports a bare
// "Failed to fetch", indistinguishable from a CORS rejection, and the real
// cause is invisible. Catching it here names the variable instead.
const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i

export function requireConfig() {
  const config = {}
  const missing = []

  for (const [field, envName] of Object.entries(CONFIG_VARS)) {
    const value = process.env[envName]?.trim()
    if (value) config[field] = value
    else missing.push(envName)
  }

  if (missing.length) {
    const error = new Error(`Missing environment variables: ${missing.join(', ')}`)
    error.statusCode = 500
    throw error
  }

  if (!ACCOUNT_ID_PATTERN.test(config.accountId)) {
    const error = new Error(
      `${CONFIG_VARS.accountId} does not look like a Cloudflare account id ` +
        '(expected 32 hex characters). Copy it from the R2 overview page — ' +
        'it is not the bucket name.'
    )
    error.statusCode = 500
    throw error
  }

  return config
}

export function makeClient(config) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Since v3.729 the SDK adds a CRC32 checksum by default. While presigning
    // there is no body, so it signs the checksum of an *empty* payload — the
    // browser's real upload then fails the integrity check. R2 does not
    // require these checksums, so turn them off.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}

// What the presign writes: posts/YYYY-MM/<uuid>.<ext>
const KEY_PATTERN = /^posts\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(mp4|mov)$/i

/**
 * Turns a public URL back into the object key — but only for a video this app
 * uploaded.
 *
 * Narrow on purpose. This is the one path that deletes, and it is driven from
 * the browser, so what it accepts is what it can destroy. Restricting it to the
 * exact key shape the presign writes, under our own public base, and to video
 * extensions alone, means it cannot be pointed at an image: images are the
 * files a scheduled post still refers to, and a video is referred to by nothing
 * once it is published.
 *
 * @returns {?string} the key, or null when the URL is not ours to delete
 */
export function videoKeyFromUrl(url, publicBase) {
  let candidate
  try {
    candidate = new URL(String(url))
  } catch {
    return null
  }

  const base = new URL(publicBase.replace(/\/+$/, '') + '/')
  if (candidate.origin !== base.origin) return null
  if (!candidate.pathname.startsWith(base.pathname)) return null

  const key = decodeURIComponent(candidate.pathname.slice(base.pathname.length))
  return KEY_PATTERN.test(key) ? key : null
}

/**
 * Removes a video, given the public URL it was served from.
 *
 * Shared by the browser-driven endpoint and the cron, so "which files may be
 * deleted" is decided once. Returns false rather than throwing when the URL is
 * not ours: at every call site the post is already published, and a failure to
 * tidy up is not a failure of the thing the user asked for.
 */
export async function deleteVideoByUrl(url) {
  const config = requireConfig()
  const key = videoKeyFromUrl(url, config.publicBase)
  if (!key) return false

  await makeClient(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
  return true
}
