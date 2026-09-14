import { randomUUID } from 'node:crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth } from '../lib/auth.js'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) })

/**
 * What this bucket will hand out a URL for, and the ceiling for each.
 *
 * Instagram accepts JPEG only for images, so nothing else is worth storing. The
 * video limits are Meta's published Reel specification — MOV or MP4, 300 MB —
 * and are enforced here as well as in the browser, because the browser check is
 * a courtesy and the signature is the actual gate: ContentLength is signed, so
 * a URL issued for a small file cannot be reused to push a large one.
 */
const UPLOAD_KINDS = {
  'image/jpeg': { ext: 'jpg', maxBytes: 8 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', maxBytes: 300 * 1024 * 1024 },
  'video/quicktime': { ext: 'mov', maxBytes: 300 * 1024 * 1024 },
}

// What every caller asked for before video existed.
const DEFAULT_TYPE = 'image/jpeg'

// A video upload is long — a 300 MB file on a home connection is minutes, not
// seconds — and the URL has to still be valid when the last byte lands.
const URL_TTL_SECONDS = 300
const VIDEO_URL_TTL_SECONDS = 3600

const CONFIG_VARS = {
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

function requireConfig() {
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

/**
 * Hands the browser a short-lived presigned PUT URL so the file goes straight
 * to R2 — the bytes never pass through this function, which keeps uploads off
 * Netlify's 6 MB request limit and off the function's execution budget.
 *
 * The object key is generated here, never taken from the client, so one caller
 * cannot overwrite another's upload, and ContentLength is part of the signature,
 * so the URL cannot be reused to push a larger file. (Content-Type is sent but
 * not signed — S3 signing covers it only when the client is forced to echo it,
 * which browsers do here anyway.)
 *
 * POST { "size": 123456, "contentType": "video/mp4" }
 *   ->  { uploadUrl, publicUrl, key, headers, expiresIn }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    requireAuth(event)

    const config = requireConfig()

    let body
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return json(400, { error: 'Request body is not valid JSON' })
    }

    const contentType = (body.contentType || DEFAULT_TYPE).toLowerCase()
    const kind = UPLOAD_KINDS[contentType]
    if (!kind) {
      return json(400, {
        error: `Cannot store "${contentType}". Instagram takes ${Object.keys(UPLOAD_KINDS).join(', ')}.`,
      })
    }

    const size = Number(body.size)
    if (!Number.isInteger(size) || size <= 0) {
      return json(400, { error: 'Provide the file size in bytes' })
    }
    if (size > kind.maxBytes) {
      return json(400, {
        error: `File exceeds the ${Math.round(kind.maxBytes / 1024 / 1024)} MB limit for ${contentType}`,
      })
    }

    const now = new Date()
    const key = [
      'posts',
      `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
      `${randomUUID()}.${kind.ext}`,
    ].join('/')

    const ttl = contentType.startsWith('video/') ? VIDEO_URL_TTL_SECONDS : URL_TTL_SECONDS

    const client = new S3Client({
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

    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
      }),
      { expiresIn: ttl }
    )

    return json(200, {
      uploadUrl,
      // Instagram fetches this URL server-side, so the bucket must be public.
      publicUrl: `${config.publicBase.replace(/\/+$/, '')}/${key}`,
      key,
      // The browser must send exactly these headers or the signature won't match.
      headers: { 'Content-Type': contentType },
      expiresIn: ttl,
    })
  } catch (error) {
    console.error('Presign failed:', error.message)
    return json(error.statusCode || 500, { error: error.message })
  }
}
