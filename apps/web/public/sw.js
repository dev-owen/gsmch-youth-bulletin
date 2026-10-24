importScripts('/precache.js');
const SHELL = 'bulletin-shell-v1';
const IMAGES = 'bulletin-images-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(self.__PRECACHE || ['/'])));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL, IMAGES].includes(key)).map((key) => caches.delete(key))))]));
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/v1/admin')) return;
  if (event.request.destination === 'image') {
    event.respondWith(fetch(event.request).catch(async () => (await caches.match(event.request)) || Response.error()));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith('/v1/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => (await caches.match('/')) || Response.error()));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) event.waitUntil(caches.open(SHELL).then((cache) => cache.put(event.request, response.clone())));
    return response;
  })));
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_COVER') {
    event.waitUntil(caches.delete(IMAGES));
    return;
  }
  if (event.data?.type !== 'CACHE_COVER') return;
  const url = new URL(event.data.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;
  event.waitUntil(fetch(new Request(url.href, { mode: 'no-cors' })).then(async (response) => {
    if (!response.ok && response.type !== 'opaque') return;
    const cache = await caches.open(IMAGES);
    await Promise.all((await cache.keys()).map((key) => cache.delete(key)));
    await cache.put(url.href, response);
  }).catch(() => {}));
});
