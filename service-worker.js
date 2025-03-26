const CACHE_NAME = "lottery-app-cache-v1";
const ASSETS_TO_CACHE = [
  "./القرعه اخر تحديث.html",
  "./manifest.json",
  "./icon-192x192.png",
  "./icon-512x512.png",
  "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
  // Add other assets like CSS, JS, and images here
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
