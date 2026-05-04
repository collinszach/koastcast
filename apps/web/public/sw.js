/**
 * nSwell Service Worker
 *
 * Capabilities:
 *   1. Cache last-viewed spot forecast for offline access
 *   2. Background sync: queue session logs when offline
 *   3. Handle push notifications for optimal window alerts
 */

const CACHE_NAME = 'nswell-v1'
const FORECAST_CACHE = 'nswell-forecasts-v1'

// Static assets to precache
const PRECACHE_URLS = [
  '/',
  '/map',
  '/offline',
]

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).catch(() => {})
  )
  self.skipWaiting()
})

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FORECAST_CACHE)
          .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Cache forecast API responses (stale-while-revalidate)
  if (url.pathname.startsWith('/api/forecast') || url.pathname.startsWith('/api/stoke')) {
    event.respondWith(
      caches.open(FORECAST_CACHE).then(async cache => {
        const cached = await cache.match(request)
        const networkPromise = fetch(request).then(response => {
          if (response.ok) {
            cache.put(request, response.clone())
          }
          return response
        }).catch(() => null)

        return cached || networkPromise || new Response(
          JSON.stringify({ error: 'Offline — showing cached data' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )
    return
  }

  // For navigation requests: serve from cache, fall back to network
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(cached => cached || caches.match('/'))
      )
    )
    return
  }

  // Default: network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

// ─── Background Sync ──────────────────────────────────────────────────────────

const SESSION_LOG_QUEUE = 'session-log-queue'

self.addEventListener('sync', event => {
  if (event.tag === SESSION_LOG_QUEUE) {
    event.waitUntil(flushSessionLogs())
  }
})

async function flushSessionLogs() {
  const db = await openDB()
  const logs = await getAll(db, 'pending_sessions')

  for (const log of logs) {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log.data),
      })
      if (res.ok) {
        await deleteRecord(db, 'pending_sessions', log.id)
      }
    } catch {
      // Will retry on next sync
    }
  }
}

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', event => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'nSwell', body: event.data.text() }
  }

  const options = {
    body: data.body || 'Check the latest surf conditions',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/map' },
    actions: [
      { action: 'view', title: 'View Forecast' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: false,
    tag: 'nswell-alert',
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'nSwell Alert', options)
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = event.notification.data?.url || '/map'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      clients.openWindow(url)
    })
  )
})

// ─── Minimal IndexedDB helpers for offline queue ──────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('nswell-offline', 1)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('pending_sessions')) {
        db.createObjectStore('pending_sessions', { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

function deleteRecord(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const req = tx.objectStore(storeName).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = e => reject(e.target.error)
  })
}
