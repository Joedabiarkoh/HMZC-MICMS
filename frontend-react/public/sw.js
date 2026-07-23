// Minimal, deliberately conservative service worker.
//
// What it does: makes the app installable (a manifest + a registered
// service worker are both required for "Add to Home Screen"/desktop
// install to be offered) and lets the app shell (HTML/JS/CSS/icons)
// load when offline, so a technician who already opened the app once
// can still open it without signal on a job site.
//
// What it deliberately does NOT do: cache anything under /api/. That
// data changes per-request (certificates, auth) and serving a cached
// copy of it would be actively wrong — you'd see stale or someone
// else's data. Offline writes (saving a certificate without a
// connection) are handled by the app itself, not this service worker
// — see src/offline/syncQueue.ts.
const SHELL_CACHE = "hmzc-shell-v1";
const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls — always go to the network, and let a
  // failure surface to the app (which queues it for retry) rather than
  // this worker silently returning something cached or synthetic.
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === "GET") {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
