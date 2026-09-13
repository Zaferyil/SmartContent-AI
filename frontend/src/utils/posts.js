import { api } from './api'

/** Reads the publishing history the functions record on every publish. */
export const fetchPosts = () => api('posts-list').then((data) => data.posts ?? [])

/**
 * Pulls fresh numbers from Instagram into the store.
 *
 * Insights lag behind publishing by hours, so a post published minutes ago
 * legitimately reads zero everywhere.
 */
export const refreshMetrics = () => api('posts-refresh', { method: 'POST' })
