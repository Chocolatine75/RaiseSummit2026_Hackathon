/**
 * AEGIS service worker (React build).
 *  - APP CODE (html + hashed /assets): NETWORK-FIRST → newest deploy always wins,
 *    cache is the offline fallback. Fixes stale-UI-after-deploy.
 *  - HEAVY IMMUTABLE (Gemma model, map tiles, MediaPipe CDN): CACHE-FIRST → makes
 *    airplane mode work. Map-pack pre-fills tiles.
 */
const CACHE = "aegis-v5";
const SHELL = ["/", "/index.html", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== "aegis-tiles").map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (["/ws", "/event"].includes(url.pathname) || url.pathname.startsWith("/api/")) return;

  const isHeavy = url.pathname.startsWith("/models/") ||
    url.hostname === "cdn.jsdelivr.net" ||
    url.hostname.endsWith("basemaps.cartocdn.com") ||
    url.hostname === "server.arcgisonline.com" ||
    url.hostname === "tile.openstreetmap.org";

  if (url.origin === location.origin && !isHeavy) {
    // Network-first for app code (html + hashed assets).
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok) { const c = res.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  if (isHeavy) {
    e.respondWith(caches.match(e.request).then((hit) => hit ||
      fetch(e.request).then((res) => { if (res.ok) { const c = res.clone(); caches.open("aegis-tiles").then((k) => k.put(e.request, c)); } return res; })));
  }
});
