/**
 * AEGIS service worker — makes airplane mode a non-event.
 * Caches: app shell + MediaPipe bundle/wasm + the Gemma model file.
 * Strategy: cache-first for everything static (the model is ~1.3GB — it gets
 * cached on the FIRST online load; verify it serves offline before the demo,
 * that's the H8 checkpoint).
 */
const CACHE = "aegis-v3";
const SHELL = ["/", "/index.html", "/styles.css", "/app.js", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return; // events/API pass through untouched

  // Never cache live endpoints.
  if (["/ws", "/event"].includes(url.pathname) || url.pathname.startsWith("/api/")) return;

  // Cache-first for: our shell, the model file, and the MediaPipe CDN (bundle + wasm).
  const cacheable =
    url.origin === location.origin ||
    url.hostname === "cdn.jsdelivr.net" ||
    url.hostname === "unpkg.com" ||
    url.hostname.endsWith("tile.openstreetmap.org") ||
    url.hostname.endsWith("basemaps.cartocdn.com");
  if (!cacheable) return;

  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
    )
  );
});
