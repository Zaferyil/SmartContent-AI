import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth } from '../lib/auth.js'
import { makeClient, requireConfig } from '../lib/r2.js'

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

    const uploadUrl = await getSignedUrl(
      makeClient(config),
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
