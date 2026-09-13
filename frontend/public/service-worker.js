// Bumped from v1 to drop caches written by the previous version, which cached
// API responses and so left stale job and calendar data behind.
const CACHE = 'smartcontentai-v2'
const PRECACHE = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !request.url.startsWith('http')) return

  const url = new URL(request.url)

  /*
   * Never touch the API.
   *
   * A cache-first worker answering these is not a stale asset, it is a wrong
   * answer: job-status polling asks the same URL over and over and would get
   * the first "running" reply back forever, so a caption that finished server
   * side never arrives and the button spins until it times out. The calendar
   * and the reports read the same way. Cache Storage ignores Cache-Control, so
   * no response header can prevent this from the server side — it has to be
   * decided here.
   */
  if (url.pathname.startsWith('/.netlify/')) return

  // Navigations: network first so a new deploy is picked up, cache as fallback.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')))
    return
  }

  // Static assets, stale-while-revalidate: serve instantly, refresh behind it
  // so a file that changed without its name changing still heals next load.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
          }
          return response
        })
        .catch(() => hit)

      return hit || network
    })
  )
})
