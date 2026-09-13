import { getStore } from '@netlify/blobs'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Persistence for posts.
 *
 * Netlify Blobs on the deployed site — no account, no provisioning, no cost.
 * Locally it is unavailable unless the directory is linked to a site
 * (MissingBlobsEnvironmentError), so this falls back to a JSON file under
 * .netlify/ and development works before the first deploy.
 *
 * The whole collection lives in one document rather than a blob per post.
 * Every screen here reads all posts at once (history, metrics, the hour
 * breakdown), and one read beats a list plus N gets. It also puts a ceiling on
 * the design: fine for the thousands of posts an account accumulates, wrong if
 * this ever became multi-tenant.
 */

const STORE_NAME = 'smartcontentai'
const POSTS_KEY = 'posts'
const LOCAL_PATH = path.resolve(process.cwd(), '.netlify/local-store/posts.json')

// Decided on first use and remembered: Blobs either works in this environment
// or it does not, and the answer cannot change mid-process.
let useLocalFile = null

function isMissingBlobsEnv(error) {
  return (
    error?.name === 'MissingBlobsEnvironmentError' ||
    /not been configured to use Netlify Blobs/i.test(error?.message ?? '')
  )
}

async function readLocal() {
  try {
    const raw = await fs.readFile(LOCAL_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return { posts: Array.isArray(parsed) ? parsed : [], etag: null }
  } catch (error) {
    if (error.code === 'ENOENT') return { posts: [], etag: null }
    throw error
  }
}

async function writeLocal(posts) {
  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true })
  await fs.writeFile(LOCAL_PATH, JSON.stringify(posts, null, 2), 'utf8')
}

/** @returns {Promise<{posts: object[], etag: string|null}>} */
export async function readPosts() {
  if (useLocalFile) return readLocal()

  try {
    const store = getStore(STORE_NAME)
    const result = await store.getWithMetadata(POSTS_KEY, { type: 'json' })
    useLocalFile = false
    return { posts: result?.data ?? [], etag: result?.etag ?? null }
  } catch (error) {
    if (!isMissingBlobsEnv(error)) throw error
    useLocalFile = true
    return readLocal()
  }
}

/**
 * Writes the collection back, refusing if it changed since `etag` was read.
 * The scheduler and a metrics refresh can run at the same time; without this
 * the slower one would silently erase the other's work.
 *
 * @returns true on success, false if the document moved on — re-read and retry.
 */
export async function writePosts(posts, etag) {
  if (useLocalFile) {
    await writeLocal(posts)
    return true
  }

  const store = getStore(STORE_NAME)
  const result = await store.setJSON(
    POSTS_KEY,
    posts,
    etag ? { onlyIfMatch: etag } : { onlyIfNew: true }
  )

  // `modified: false` means the precondition failed — someone else wrote first.
  if (result && result.modified === false) return false
  return true
}

/** Read, apply `mutate`, write — retrying when a concurrent write wins the race. */
export async function updatePosts(mutate, { attempts = 4 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const { posts, etag } = await readPosts()
    const next = await mutate(posts)

    // A mutation may decline to change anything.
    if (next === null || next === undefined) return posts

    if (await writePosts(next, etag)) return next
  }

  const error = new Error('Could not save: the post list kept changing under us')
  error.statusCode = 409
  throw error
}
