/** Reads the publishing history the functions record on every publish. */
export async function fetchPosts() {
  const response = await fetch('/.netlify/functions/posts-list')
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Could not load posts (HTTP ${response.status})`)
  return data.posts ?? []
}

/**
 * Pulls fresh numbers from Instagram into the store, then returns the updated
 * list. Insights lag behind publishing by hours, so a post published minutes
 * ago legitimately reads zero everywhere.
 */
export async function refreshMetrics() {
  const response = await fetch('/.netlify/functions/posts-refresh', { method: 'POST' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Refresh failed (HTTP ${response.status})`)
  return data
}
