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
const LOCAL_DIR = path.resolve(process.cwd(), '.netlify/local-store')

// Decided on first use and remembered: Blobs either works in this environment
// or it does not, and the answer cannot change mid-process.
let useLocalFile = null

function isMissingBlobsEnv(error) {
  return (
    error?.name === 'MissingBlobsEnvironmentError' ||
    /not been configured to use Netlify Blobs/i.test(error?.message ?? '')
  )
}

const localPath = (key) => path.join(LOCAL_DIR, `${key}.json`)

async function readLocal(key) {
  try {
    const raw = await fs.readFile(localPath(key), 'utf8')
    const parsed = JSON.parse(raw)
    return { items: Array.isArray(parsed) ? parsed : [], etag: null }
  } catch (error) {
    if (error.code === 'ENOENT') return { items: [], etag: null }
    throw error
  }
}

async function writeLocal(key, value) {
  await fs.mkdir(LOCAL_DIR, { recursive: true })
  await fs.writeFile(localPath(key), JSON.stringify(value, null, 2), 'utf8')
}

/** @returns {Promise<{items: object[], etag: string|null}>} */
export async function readDoc(key) {
  if (useLocalFile) return readLocal(key)

  try {
    const store = getStore(STORE_NAME)
    const result = await store.getWithMetadata(key, { type: 'json' })
    useLocalFile = false
    return { items: result?.data ?? [], etag: result?.etag ?? null }
  } catch (error) {
    if (!isMissingBlobsEnv(error)) throw error
    useLocalFile = true
    return readLocal(key)
  }
}

/**
 * Writes the collection back, refusing if it changed since `etag` was read.
 * The scheduler and a metrics refresh can run at the same time; without this
 * the slower one would silently erase the other's work.
 *
 * @returns true on success, false if the document moved on — re-read and retry.
 */
export async function writeDoc(key, items, etag) {
  if (useLocalFile) {
    await writeLocal(key, items)
    return true
  }

  const store = getStore(STORE_NAME)
  const result = await store.setJSON(
    key,
    items,
    etag ? { onlyIfMatch: etag } : { onlyIfNew: true }
  )

  // `modified: false` means the precondition failed — someone else wrote first.
  if (result && result.modified === false) return false
  return true
}

/** Read, apply `mutate`, write — retrying when a concurrent write wins the race. */
export async function updateDoc(key, mutate, { attempts = 4 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const { items, etag } = await readDoc(key)
    const next = await mutate(items)

    // A mutation may decline to change anything.
    if (next === null || next === undefined) return items

    if (await writeDoc(key, next, etag)) return next
  }

  const error = new Error(`Could not save "${key}": it kept changing under us`)
  error.statusCode = 409
  throw error
}
