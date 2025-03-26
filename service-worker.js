const CACHE_NAME = "lottery-app-cache-v1";
const ASSETS_TO_CACHE = [
  "./index.html",
  "./manifest.json",
  "./https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/%D8%B5%D9%88%D8%B1%20%D8%A7%D9%84%D9%82%D8%B1%D8%B9%D9%87%2F656ceed7-79c9-4f96-88d9-305066fcafd8%20(1).png?alt=media&token=42580a66-37c4-4b4a-a601-49e60a3b868e",
  "./https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/%D8%B5%D9%88%D8%B1%20%D8%A7%D9%84%D9%82%D8%B1%D8%B9%D9%87%2F656ceed7-79c9-4f96-88d9-305066fcafd8%20(1).png?alt=media&token=42580a66-37c4-4b4a-a601-49e60a3b868e",
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
