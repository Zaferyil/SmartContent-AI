import { getStore } from '@netlify/blobs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { isDeployed } from './runtime.js'

/**
 * Persistence for posts, accounts, the schedule and settings.
 *
 * Netlify Blobs on the deployed site — no account, no provisioning, no cost.
 * Locally Blobs is unavailable unless the directory is linked to a site, so
 * this falls back to a JSON file under .netlify/ and development works before
 * the first deploy.
 *
 * That fallback is for a developer's laptop and nowhere else. A serverless
 * runtime has a read-only disk that is thrown away between invocations, so
 * falling back there turns a configuration problem into two much worse ones:
 * reads quietly answer "empty" (the app then reports no connected accounts,
 * as though they had been lost) and writes fail with an mkdir error that says
 * nothing about the real cause. On a server it must refuse instead.
 *
 * The whole collection lives in one document rather than a blob per post.
 * Every screen here reads all posts at once (history, metrics, the hour
 * breakdown), and one read beats a list plus N gets. It also puts a ceiling on
 * the design: fine for the thousands of posts an account accumulates, wrong if
 * this ever became multi-tenant.
 */

const STORE_NAME = 'smartcontentai'
const LOCAL_DIR = path.resolve(process.cwd(), '.netlify/local-store')

/** True inside a deployed function, where there is no writable disk. */
const isServerless = isDeployed

/** What Netlify Blobs needs in order to find the site it belongs to. */
const hasBlobsContext = () =>
  Boolean(globalThis.netlifyBlobsContext || process.env.NETLIFY_BLOBS_CONTEXT)

/**
 * Reads the first of these that has a value, trimmed.
 *
 * Trimming matters: a token pasted into a settings field often arrives with a
 * stray newline, which turns a perfectly good credential into a malformed
 * Authorization header and a rejection that looks like a permissions problem.
 */
const envValue = (...names) => {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return null
}

export const explicitSiteId = () => envValue('BLOBS_SITE_ID', 'SITE_ID')
const explicitToken = () => envValue('BLOBS_TOKEN', 'NETLIFY_API_TOKEN')

/**
 * Opens the store, by hand when Netlify has not done it for us.
 *
 * Normally the runtime injects NETLIFY_BLOBS_CONTEXT and `getStore(name)` just
 * works. On this site it does not, while SITE_ID is present — so Blobs is
 * reachable, it just has not been handed the credentials. Netlify documents
 * passing siteID and token explicitly for exactly this case, and that turns an
 * unusable deploy into a working one without waiting for the automatic path.
 */
function openStore() {
  if (hasBlobsContext()) return getStore(STORE_NAME)

  const siteID = explicitSiteId()
  const token = explicitToken()

  if (siteID && token) return getStore(STORE_NAME, { siteID, token })

  // Neither route available: let Blobs raise its own error, which the callers
  // turn into the message explaining what to configure.
  return getStore(STORE_NAME)
}

// Decided on first use and remembered: Blobs either works in this environment
// or it does not, and the answer cannot change mid-process.
let useLocalFile = null

function isMissingBlobsEnv(error) {
  return (
    error?.name === 'MissingBlobsEnvironmentError' ||
    /not been configured to use Netlify Blobs/i.test(error?.message ?? '')
  )
}

/**
 * Blobs is unreachable somewhere it should not be. Say so, with the one thing
 * that is actually wrong and where to look — the alternative is an ENOENT from
 * a doomed mkdir that reads like a bug in the app.
 */
function blobsUnavailable(cause) {
  const error = new Error(
    'Storage is unavailable: this deploy cannot reach Netlify Blobs, so nothing can be saved or read. ' +
      'Fix: create a Netlify personal access token (User settings → Applications → Personal access tokens) ' +
      'and add it to this site as the environment variable BLOBS_TOKEN, then redeploy. ' +
      `(NETLIFY_BLOBS_CONTEXT ${hasBlobsContext() ? 'present' : 'missing'}; ` +
      `SITE_ID ${explicitSiteId() ? 'present' : 'missing'}; ` +
      `BLOBS_TOKEN ${explicitToken() ? 'present' : 'missing'}` +
      `${cause ? `; ${cause}` : ''})`
  )
  error.statusCode = 503
  return error
}

/**
 * Blobs answered, and said no.
 *
 * A rejected token is a different problem from a missing one and needs a
 * different answer, so it gets its own message rather than being folded into
 * "unavailable" — the token exists and is simply not allowed near this site.
 */
function blobsRejected(cause) {
  const error = new Error(
    'Netlify rejected the storage token: it is not allowed to access this site. ' +
      'Check that BLOBS_TOKEN is a personal access token created by the same Netlify ' +
      'account that owns this site (User settings → Applications → Personal access tokens), ' +
      `and that it was pasted in full. (site ${explicitSiteId() ?? 'unknown'}${
        cause ? `; ${cause}` : ''
      })`
  )
  error.statusCode = 503
  return error
}

/** Blobs reporting that the credentials were understood but refused. */
const isBlobsAccessDenied = (error) =>
  /401|403|Access Denied|does not have access/i.test(error?.message ?? '')

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
    const store = openStore()
    const result = await store.getWithMetadata(key, { type: 'json' })
    useLocalFile = false
    return { items: result?.data ?? [], etag: result?.etag ?? null }
  } catch (error) {
    if (isBlobsAccessDenied(error)) throw blobsRejected(error.message)
    if (!isMissingBlobsEnv(error)) throw error

    // On a server the file fallback cannot work and must not be tried: an empty
    // read here would be reported to the user as "no accounts connected".
    if (isServerless()) throw blobsUnavailable(error.message)

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
    // Reached only after a read already chose the file path, which cannot
    // happen on a server — but a write onto a read-only disk deserves the
    // explanation rather than a bare mkdir failure.
    if (isServerless()) throw blobsUnavailable('write attempted on a read-only filesystem')
    await writeLocal(key, items)
    return true
  }

  const store = openStore()
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

/** Netlify's own variables, whose presence is safe to report. Values never are. */
const NETLIFY_VARS = [
  'NETLIFY',
  'NETLIFY_DEV',
  'NETLIFY_BLOBS_CONTEXT',
  'SITE_ID',
  'SITE_NAME',
  'DEPLOY_ID',
  'CONTEXT',
  'AWS_LAMBDA_FUNCTION_NAME',
]

/**
 * Asks Netlify's own API what it thinks of the token, and reports only the
 * status code.
 *
 * Blobs answering 401 does not say whether the token is invalid, belongs to
 * another account, or simply cannot see this site — and those need different
 * fixes. This separates them: 200 means the token reaches this site and the
 * problem is Blobs-specific; 401 means the token itself is rejected; 404 means
 * it is valid but cannot see this site, which is what a different account or
 * team looks like.
 *
 * The token is sent to Netlify, where it came from, and never appears in the
 * result.
 */
async function probeToken() {
  const siteID = explicitSiteId()
  const token = explicitToken()
  if (!siteID || !token) return null

  const headers = { Authorization: `Bearer ${token}` }

  // Two calls, because one cannot tell these apart. /user asks whether the
  // token is valid at all; the site's env asks whether *this* token may touch
  // *this* site. Note that GET /sites/{id} is useless for this — it answers 200
  // to an invalid token, since basic site information is public.
  const check = async (path) => {
    try {
      return (await fetch(`https://api.netlify.com/api/v1/${path}`, { headers })).status
    } catch (error) {
      return `failed: ${error.message}`
    }
  }

  const [tokenValid, siteAccess] = await Promise.all([
    check('user'),
    check(`sites/${siteID}/env`),
  ])

  return { tokenValid, siteAccess }
}

/**
 * Whether this deploy can actually store anything, established by trying.
 *
 * A round trip is the only honest answer: the context can be present and the
 * store still unreachable. It writes to a throwaway key rather than to real
 * data, so a failure costs nothing.
 */
export async function storageDiagnostics() {
  const environment = NETLIFY_VARS.filter((name) => Boolean(process.env[name]))

  const result = {
    mode: useLocalFile ? 'local-file' : 'netlify-blobs',
    serverless: isServerless(),
    blobsContext: hasBlobsContext(),
    // Reported so the manual route can be told apart from the automatic one.
    explicitCredentials: Boolean(explicitSiteId() && explicitToken()),
    // The site id is shown openly in Netlify's own UI. The token never appears;
    // only its length, which is what catches a truncated or padded paste.
    siteId: explicitSiteId(),
    tokenLength: explicitToken()?.length ?? 0,
    tokenCheck: await probeToken(),
    environment,
    canRead: false,
    canWrite: false,
    error: null,
  }

  const key = '__diagnostic'

  try {
    const { etag } = await readDoc(key)
    result.canRead = true
    result.mode = useLocalFile ? 'local-file' : 'netlify-blobs'

    await writeDoc(key, [{ checkedAt: new Date().toISOString() }], etag)
    result.canWrite = true
  } catch (error) {
    result.error = error.message
  }

  return result
}
