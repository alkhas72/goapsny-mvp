self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Honest PWA shell: network-only, no offline cache claim.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
