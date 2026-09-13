import { json, CORS } from '../lib/instagram.js'
import { listPosts } from '../lib/posts.js'

/**
 * The recorded publishing history, newest first.
 *
 * GET -> { ok: true, posts: [...] }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  try {
    const posts = await listPosts()
    return json(200, { ok: true, posts, count: posts.length })
  } catch (error) {
    console.error('Could not list posts:', error.message)
    return json(error.statusCode || 500, { ok: false, error: error.message })
  }
}
