self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Honest PWA shell: network-only, no offline cache claim.
self.addEventListener('fetch', (event) => {
  // Запросы с телом (фото входа, отправка карточки) браузер шлёт сам.
  // Пересылать их через воркер незачем, а Safari на iPhone при такой
  // пересылке может потерять тело запроса с файлом.
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});
