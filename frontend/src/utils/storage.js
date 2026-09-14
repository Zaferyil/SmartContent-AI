import { api } from './api'

/**
 * Uploads a file to R2 through a presigned URL and returns the public URL
 * Instagram will fetch.
 *
 * Asking for the presigned URL goes through our own API, so it carries the app
 * password. The upload itself must not: it goes to Cloudflare, the URL's
 * signature is its authorisation, and an extra header would both leak the
 * password to a third party and break the signature.
 *
 * @param blob        the bytes to store
 * @param contentType must match what the presign was asked for — the signature
 *                    covers it
 * @param onProgress  called with 0..1 while the bytes go out. A reel can be
 *                    300 MB, which is minutes on a home connection, and a
 *                    spinner that never moves for that long is indistinguishable
 *                    from one that has hung.
 */
export async function uploadToStorage(blob, { contentType = 'image/jpeg', onProgress } = {}) {
  const presign = await api('upload-url', { body: { size: blob.size, contentType } })

  if (onProgress) await putWithProgress(presign, blob, onProgress)
  else await put(presign, blob)

  return presign.publicUrl
}

/**
 * Removes a video from storage once every channel has published it.
 *
 * Deliberately not a failure worth showing. By the time this runs the post is
 * live on Instagram, which is the thing the user asked for; a file left behind
 * costs a few megabytes of a 10 GB allowance and nothing else. Turning that
 * into an error message on a successful publish would be the app reporting its
 * own housekeeping as the user's problem.
 */
export async function deleteStoredVideo(url) {
  if (!url) return false
  try {
    await api('storage-delete', { body: { url } })
    return true
  } catch (error) {
    console.warn('Could not remove the video from storage:', error.message)
    return false
  }
}

/**
 * The browser reports a blocked cross-origin request and a host that does not
 * exist the same way: a bare error with nothing in it. The one thing that
 * separates them is where the upload was being sent — a wrong or truncated R2
 * account id produces an address that resolves to nothing, which looks exactly
 * like a CORS rejection from the outside. So the message carries the host,
 * which makes that visible at a glance.
 */
function blocked(uploadUrl, cause) {
  let host = 'unknown'
  try {
    host = new URL(uploadUrl).host
  } catch {
    /* keep 'unknown' */
  }

  return Object.assign(new Error(`storage-blocked:${host}:${cause.message}`), {
    code: 'storage-blocked',
    origin: window.location.origin,
    host,
    cause,
  })
}

const rejected = (status) => new Error(`Upload rejected by storage (HTTP ${status})`)

async function put(presign, blob) {
  let response
  try {
    response = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: presign.headers,
      body: blob,
    })
  } catch (error) {
    throw blocked(presign.uploadUrl, error)
  }

  if (!response.ok) throw rejected(response.status)
}

/**
 * The same PUT through XMLHttpRequest, which is the only API in the browser
 * that reports how much of a request body has gone out — fetch cannot.
 */
function putWithProgress(presign, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', presign.uploadUrl)
    Object.entries(presign.headers ?? {}).forEach(([name, value]) =>
      request.setRequestHeader(name, value)
    )

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(rejected(request.status))
    // XHR gives no detail on a failed request either — same two causes, same
    // message, so the host is named here too.
    request.onerror = () => reject(blocked(presign.uploadUrl, new Error('network error')))
    request.onabort = () => reject(blocked(presign.uploadUrl, new Error('aborted')))
    request.ontimeout = () => reject(blocked(presign.uploadUrl, new Error('timed out')))

    request.send(blob)
  })
}
