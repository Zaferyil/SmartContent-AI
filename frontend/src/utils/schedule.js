async function call(url, options) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status})`)
  return data
}

const post = (url, body) =>
  call(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/** The calendar, the publishing settings, and what the server can actually publish to. */
export const fetchSchedule = () => call('/.netlify/functions/schedule-list')

/** Creates or updates scheduled posts. Takes a list so AI planning is one write. */
export const saveScheduled = (items) =>
  post('/.netlify/functions/schedule-save', { items }).then((data) => data.items)

export const deleteScheduled = (ids) =>
  post('/.netlify/functions/schedule-delete', { ids }).then((data) => data.items)

export const saveSettings = (settings) =>
  post('/.netlify/functions/settings-save', settings).then((data) => data.settings)
