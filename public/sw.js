/* Basic PWA SW for Fruit POS */
const STATIC_CACHE = "static-v2";
const API_CACHE = "api-v2";

// Only cache truly static, guaranteed files at install.
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/offline.html",
  "/icons/fruit-pos-icon-192.png",
  "/icons/fruit-pos-icon-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => { /* don’t fail install */ })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => {
        if (![STATIC_CACHE, API_CACHE].includes(k)) return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

// Allow page to send {type:'SKIP_WAITING'} to activate new SW immediately
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Fetch strategy:
// 1) Navigations -> network-first, fallback to offline.html
// 2) Static assets (script/style/image/font) -> cache-first
// 3) API GET (/api/*) -> stale-while-revalidate
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // same-origin only
  if (url.origin !== self.location.origin) return;

  // 1) Navigations
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const netRes = await fetch(req);
        // cache successful navigations for offline revisit
        const copy = netRes.clone();
        event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.put(req, copy)));
        return netRes;
      } catch {
        // try cached page, otherwise offline.html
        const cached = await caches.match(req);
        return cached || (await caches.match("/offline.html"));
      }
    })());
    return;
  }

  // 2) Static assets
  if (["style", "script", "image", "font"].includes(req.destination)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.put(req, copy)));
          return res;
        }).catch(() => caches.match("/offline.html"));
      })
    );
    return;
  }

  // 3) API GET -> stale-while-revalidate
  if (req.method === "GET" && url.pathname.startsWith("/api/")) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        return cached || network || new Response("offline", { status: 503 });
      })
    );
  }
});
