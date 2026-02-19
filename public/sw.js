self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('af-madness-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/madness/home',
        '/icon-192.png',
        '/icon-512.png',
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
