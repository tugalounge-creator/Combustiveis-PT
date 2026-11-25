const CACHE_NAME = "combustiveis-pt-v174";
const STATIC_ASSETS = [
  "/",
  "/manifest.json"
];

async function safeCachePut(cacheName, request, response) {
  try {
    if (!response || !response.ok || response.type === "opaque" || response.bodyUsed) {
      return;
    }
    const clone = response.clone();
    const cache = await caches.open(cacheName);
    await cache.put(request, clone);
  } catch (_) {
    // Evita rejeicoes caso o corpo ja tenha sido consumido ou a cache falhe
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        STATIC_ASSETS.map((asset) =>
          fetch(asset)
            .then((res) => {
              if (res && res.ok && !res.bodyUsed) {
                return cache.put(asset, res.clone()).catch(() => null);
              }
              return null;
            })
            .catch(() => null)
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isDynamic =
    url.pathname.startsWith("/api/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/";

  if (isDynamic) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (!url.pathname.startsWith("/api/")) {
            event.waitUntil(safeCachePut(CACHE_NAME, req, res));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          event.waitUntil(safeCachePut(CACHE_NAME, req, res));
          return res;
        })
        .catch(() => null);

      return cached || networkFetch;
    })
  );
});