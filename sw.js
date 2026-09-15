const CACHE_NAME = "meu-caixa-v13";
const APP_SHELL = "/index.html";
const ASSETS = [
  APP_SHELL,
  "/styles.css?v=10",
  "/app.js?v=12",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon.svg",
];

const canCache = (response) =>
  response &&
  response.ok &&
  !response.redirected &&
  response.type !== "opaqueredirect";

async function cacheFresh(request) {
  const response = await fetch(request, { cache: "no-store", redirect: "follow" });
  if (canCache(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.allSettled(
      ASSETS.map((asset) => cacheFresh(new Request(asset, { credentials: "same-origin" })))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store", redirect: "follow" })
        .then(async (response) => {
          if (!canCache(response)) {
            const fallback = await caches.match(APP_SHELL);
            if (fallback) return fallback;
            const shell = await fetch(APP_SHELL, { cache: "no-store" });
            if (canCache(shell)) return shell;
            return new Response("<main>Meu Caixa indisponivel no momento.</main>", {
              headers: { "Content-Type": "text/html; charset=utf-8" },
              status: 503,
            });
          }

          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_SHELL, response.clone());
          return response;
        })
        .catch(() => caches.match(APP_SHELL))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached && !cached.redirected && cached.type !== "opaqueredirect") return cached;
      return cacheFresh(event.request).catch(() => cached || caches.match(event.request));
    })
  );
});
