import { randomUUID } from 'node:crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) })

// Instagram accepts JPEG only for feed images, so nothing else is worth storing.
const ALLOWED_TYPE = 'image/jpeg'
const MAX_BYTES = 8 * 1024 * 1024
const URL_TTL_SECONDS = 300

const CONFIG_VARS = {
  accountId: 'R2_ACCOUNT_ID',
  accessKeyId: 'R2_ACCESS_KEY_ID',
  secretAccessKey: 'R2_SECRET_ACCESS_KEY',
  bucket: 'R2_BUCKET',
  publicBase: 'R2_PUBLIC_BASE_URL',
}

function requireConfig() {
  const config = {}
  const missing = []

  for (const [field, envName] of Object.entries(CONFIG_VARS)) {
    const value = process.env[envName]
    if (value) config[field] = value
    else missing.push(envName)
  }

  if (missing.length) {
    const error = new Error(`Missing environment variables: ${missing.join(', ')}`)
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
 * POST { "size": 123456 }  ->  { uploadUrl, publicUrl, headers }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const config = requireConfig()

    let body
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return json(400, { error: 'Request body is not valid JSON' })
    }

    const size = Number(body.size)
    if (!Number.isInteger(size) || size <= 0) {
      return json(400, { error: 'Provide the file size in bytes' })
    }
    if (size > MAX_BYTES) {
      return json(400, { error: `File exceeds the ${MAX_BYTES / 1024 / 1024} MB limit` })
    }

    const now = new Date()
    const key = [
      'posts',
      `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
      `${randomUUID()}.jpg`,
    ].join('/')

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
        ContentType: ALLOWED_TYPE,
        ContentLength: size,
      }),
      { expiresIn: URL_TTL_SECONDS }
    )

    return json(200, {
      uploadUrl,
      // Instagram fetches this URL server-side, so the bucket must be public.
      publicUrl: `${config.publicBase.replace(/\/+$/, '')}/${key}`,
      key,
      // The browser must send exactly these headers or the signature won't match.
      headers: { 'Content-Type': ALLOWED_TYPE },
      expiresIn: URL_TTL_SECONDS,
    })
  } catch (error) {
    console.error('Presign failed:', error.message)
    return json(error.statusCode || 500, { error: error.message })
  }
}
