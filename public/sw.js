/**
 * AEGIS service worker.
 *
 * Two strategies, on purpose:
 *  - APP CODE (html/css/js): NETWORK-FIRST. You always get the latest deploy;
 *    the cache is only a fallback for when the network is gone. This is what
 *    fixes "I still see the old UI after redeploying."
 *  - HEAVY IMMUTABLE ASSETS (Gemma model, map tiles, CDN libs): CACHE-FIRST,
 *    because those are big and never change — this is what makes airplane mode
 *    work. The map-pack beat pre-fills the tile cache.
 */
const CACHE = "aegis-v4";
const SHELL = ["/", "/index.html", "/styles.css", "/app.js", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== "aegis-tiles").map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return; // events/API pass through untouched
  if (["/ws", "/event"].includes(url.pathname) || url.pathname.startsWith("/api/")) return;

  const isAppCode = url.origin === location.origin &&
    !url.pathname.startsWith("/models/"); // model is heavy+immutable → cache-first
  const isHeavyImmutable =
    url.pathname.startsWith("/models/") ||
    url.hostname === "cdn.jsdelivr.net" ||
    url.hostname === "tile.openstreetmap.org";

  if (isAppCode) {
    // Network-first: fresh deploy wins; cache is the offline fallback.
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) { const c = res.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  if (isHeavyImmutable) {
    e.respondWith(
      caches.match(e.request).then((hit) =>
        hit || fetch(e.request).then((res) => {
          if (res.ok) { const c = res.clone(); caches.open("aegis-tiles").then((k) => k.put(e.request, c)); }
          return res;
        })
      )
    );
  }
});
