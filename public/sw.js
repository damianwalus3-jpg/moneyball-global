const CACHE_PREFIX = "moneyball-shell-";
const CACHE_VERSION = "v2";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API responses are deliberately network-only: fixture feeds and results
  // must never be replaced with stale service-worker cache entries.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cached = await caches.match("/", { cacheName: CACHE_NAME });
      return cached || Response.error();
    }));
    return;
  }

  // Cache-first for same-origin build assets; Vite's hashed asset names make
  // old entries harmless until the next service-worker version activates.
  event.respondWith(caches.match(request).then(async cached => {
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  }));
});
