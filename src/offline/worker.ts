// Kept as a template so the HTTP route can embed this deployment's immutable assets.
export function workerSource(version: string, assets: string[]) {
  return `
const CACHE = ${JSON.stringify(`doneward-app-${version}`)};
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(ASSETS.map(url => new Request(url, { cache: "reload" })));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(caches.open(CACHE).then(cache => cache.match("/")));
  } else if (url.pathname.startsWith("/_next/static/")) {
    // Older open tabs may still need their immutable chunks after activation.
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
self.addEventListener("message", event => {
  if (event.data === "APPLY_UPDATE") event.waitUntil(self.skipWaiting());
});
`;
}
