// Apex University Service Worker
// Security contract:
//   - NEVER cache /api/* responses (auth tokens, enrollment checks, signed URLs)
//   - NEVER cache /learn/* lesson content (paid, gated behind auth)
//   - NEVER cache /w/*/auth/* pages
//   - NEVER cache URLs containing "token=", "signed", or Supabase storage private
//   - Cache ONLY: static assets (_next/static), public pages, icons, manifest
//
// Strategy: Cache-first for static assets, Network-first for public pages,
//           Offline fallback for navigation requests.

const CACHE_VERSION = 'apex-v1'
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const PAGES_CACHE   = `${CACHE_VERSION}-pages`

// Static assets always safe to cache (content-hashed by Next.js)
const STATIC_PATTERNS = [
  /\/_next\/static\//,
  /\/icons\//,
  /\/images\//,
  /\/manifest\.json$/,
  /\.(?:woff2?|ttf|eot)$/,
]

// Public navigation pages safe to cache with network-first
const PUBLIC_PAGE_PATTERNS = [
  /^\/w\/[^/]+\/?$/,               // workspace home
  /^\/w\/[^/]+\/courses\/?$/,      // course catalogue
  /^\/w\/[^/]+\/courses\/[^/]+\/?$/, // course detail (public)
  /^\/w\/[^/]+\/community\/?$/,    // community (public feed)
  /^\/offline$/,
]

// URLs we must NEVER cache under any circumstances
const NEVER_CACHE_PATTERNS = [
  /\/api\//,
  /\/learn\//,
  /\/auth\//,
  /\/dashboard/,
  /\/profile/,
  /\/membership/,
  /\/affiliate/,
  /\/leaderboard/,
  /\/platform\//,
  /\/admin\//,
  /token=/i,
  /signed/i,
  /supabase\.co\/storage/,
]

function isNeverCache(url) {
  return NEVER_CACHE_PATTERNS.some((p) => p.test(url))
}

function isStaticAsset(url) {
  return STATIC_PATTERNS.some((p) => p.test(url))
}

function isPublicPage(pathname) {
  return PUBLIC_PAGE_PATTERNS.some((p) => p.test(pathname))
}

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        '/offline',
        '/manifest.json',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
      ]).catch(() => { /* non-fatal: icons may not exist yet */ })
    ).then(() => self.skipWaiting())
  )
})

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Only handle same-origin GET requests
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  // Hard security rule: never intercept protected routes
  if (isNeverCache(url.href)) return

  // Static assets: cache-first (Next.js content-hashes these)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req)
        if (cached) return cached
        const fresh = await fetch(req)
        if (fresh.ok) cache.put(req, fresh.clone())
        return fresh
      })
    )
    return
  }

  // Public pages: network-first, fall back to cache, then offline page
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    if (isNeverCache(url.pathname)) return  // double-check for navigation

    if (isPublicPage(url.pathname)) {
      event.respondWith(
        caches.open(PAGES_CACHE).then(async (cache) => {
          try {
            const fresh = await fetch(req)
            if (fresh.ok) cache.put(req, fresh.clone())
            return fresh
          } catch {
            const cached = await cache.match(req)
            if (cached) return cached
            return caches.match('/offline') ?? Response.error()
          }
        })
      )
      return
    }

    // All other navigation (dashboard, learn, auth, etc.) — network only, no cache
    // If offline, show offline page
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('/offline').then((r) => r ?? Response.error())
      )
    )
    return
  }
})
