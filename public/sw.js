const STATIC_CACHE = "static-v1";
const PAGES_CACHE = "pages-v1";
const EXPECTED_CACHES = [STATIC_CACHE, PAGES_CACHE];
const MAX_STATIC_ENTRIES = 250;

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    for (let i = 0; i < keys.length - maxEntries; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// URLs that must never be intercepted by the service worker.
// Neon auth/data API, PowerSync sync API, internal API routes, and analytics
// all rely on live network requests — caching them would break sync or
// produce stale data.
function shouldBypass(url) {
  if (url.protocol === "chrome-extension:") {
    return true;
  }
  if (url.hostname.endsWith(".powersync.journeyapps.com")) {
    return true;
  }
  if (url.hostname.includes(".neonauth.")) {
    return true;
  }
  if (url.hostname.includes(".apirest.")) {
    return true;
  }
  if (url.hostname === "va.vercel-scripts.com") {
    return true;
  }
  if (url.hostname === "vitals.vercel-insights.com") {
    return true;
  }
  if (url.pathname.startsWith("/api/")) {
    return true;
  }
  return false;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !EXPECTED_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache cross-origin sync/API/analytics requests
  if (shouldBypass(url)) {
    return;
  }

  // Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Cache-first for immutable static assets: Next.js content-hashed bundles
  // and PowerSync WASM binaries / web workers required for offline SQLite access.
  // Only cache responses the server marks as immutable — production Next.js
  // builds set `Cache-Control: immutable` on /_next/static/ chunks, while
  // Turbopack dev reuses URLs with changing content (no immutable header).
  // PowerSync WASM/worker assets are always cached regardless of headers.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/@powersync/")
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then(
          (cached) =>
            cached ||
            fetch(event.request).then((response) => {
              const isSafeToCacheForever =
                url.pathname.startsWith("/@powersync/") ||
                (response.headers.get("cache-control") || "").includes(
                  "immutable"
                );
              if (response.ok && isSafeToCacheForever) {
                cache.put(event.request, response.clone());
                trimCache(STATIC_CACHE, MAX_STATIC_ENTRIES);
              }
              return response;
            })
        )
      )
    );
    return;
  }

  // Accepted trade-off: cached HTML contains the per-request CSP nonce from
  // the original response. When served offline, the nonce is replayed (no
  // longer single-use). This weakens nonce-based CSP but is inherent to any
  // PWA that caches server-rendered HTML. The alternative — stripping the
  // nonce — would break all inline scripts in the cached page.

  // Stale-while-revalidate for same-origin navigation (HTML pages)
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.open(PAGES_CACHE).then((cache) =>
        fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cache.match(event.request))
      )
    );
    return;
  }
});

self.addEventListener("push", (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title =
        typeof data.title === "string" ? data.title : "The Magic Lab";
      const body = typeof data.body === "string" ? data.body : "";
      const options = {
        body,
        icon:
          typeof data.icon === "string" && data.icon.startsWith("/")
            ? data.icon
            : "/icon-192x192.png",
        badge: "/icon-192x192.png",
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: "1",
        },
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch {
      event.waitUntil(
        self.registration.showNotification("The Magic Lab", {
          body: "You have a new notification.",
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
        })
      );
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(self.location.origin));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-user-cache") {
    event.waitUntil(caches.delete(PAGES_CACHE));
  }
});
