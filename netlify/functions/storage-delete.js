import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { requireAuth } from '../lib/auth.js'
import { makeClient, requireConfig, videoKeyFromUrl } from '../lib/r2.js'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-App-Password',
}

const json = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) })

/**
 * Removes a reel's video from storage once Instagram has published it.
 *
 * Instagram fetches the media itself, from a public URL, so a video has to be
 * hosted before it can be posted — but only until the post exists. After that
 * Instagram serves its own copy and the file here is dead weight against a
 * 10 GB bucket. A reel is 20-100 MB where an image is half a megabyte, so
 * videos are the only thing in this bucket that would ever fill it.
 *
 * Only videos, and only ones this app uploaded: videoKeyFromUrl accepts nothing
 * else. Images are still referred to by scheduled posts and by the reports, so
 * an endpoint that could reach them would be a way to break those from the
 * browser.
 *
 * POST { "url": "https://<public base>/posts/2026-09/<uuid>.mp4" }
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

    const key = videoKeyFromUrl(body.url, config.publicBase)
    if (!key) {
      return json(400, { error: 'That is not the URL of a video this app uploaded' })
    }

    await makeClient(config).send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
    )

    return json(200, { ok: true, key })
  } catch (error) {
    console.error('Storage delete failed:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
