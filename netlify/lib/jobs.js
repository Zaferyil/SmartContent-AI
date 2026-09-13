import { randomUUID } from 'node:crypto'
import { readDoc, updateDoc } from './store.js'

const KEY = 'jobs'

// Finished jobs are only useful until the browser has collected the result.
// Anything older is dead weight in a document every request reads.
const KEEP_MS = 60 * 60 * 1000

/**
 * Work that outlives a request.
 *
 * A synchronous Netlify function is cut off at 10s on the free plan, and both
 * of the slow paths here exceed it — writing a caption from an image measured
 * 17s, and creating an Instagram media container 9.5s. A background function
 * gets 15 minutes but answers the caller with an empty 202, so the result has
 * to be left somewhere the browser can come back for. That is this.
 *
 * @typedef {object} Job
 * @property {string}  id
 * @property {string}  type      'caption' | 'publish'
 * @property {string}  status    'running' | 'done' | 'failed'
 * @property {?object} result    set when status is 'done'
 * @property {?string} error     set when status is 'failed'
 */

const prune = (jobs) => {
  const cutoff = Date.now() - KEEP_MS
  return jobs.filter((job) => job.status === 'running' || Date.parse(job.updatedAt) > cutoff)
}

export async function createJob(type) {
  const job = {
    id: randomUUID(),
    type,
    status: 'running',
    result: null,
    error: null,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await updateDoc(KEY, (jobs) => [...prune(jobs), job])
  return job
}

async function settle(id, patch) {
  await updateDoc(KEY, (jobs) =>
    prune(jobs).map((job) =>
      job.id === id ? { ...job, ...patch, updatedAt: new Date().toISOString() } : job
    )
  )
}

export const finishJob = (id, result) => settle(id, { status: 'done', result, error: null })

export const failJob = (id, error) =>
  settle(id, { status: 'failed', error: String(error?.message ?? error) })

export async function getJob(id) {
  const { items: jobs } = await readDoc(KEY)
  return jobs.find((job) => job.id === id) ?? null
}
