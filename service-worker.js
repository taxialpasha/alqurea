const CACHE_NAME = 'investor-portfolio-v1';
const OFFLINE_URL = 'offline.html';
const ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/auth-manager.js',
    '/js/investor-data-manager.js',
    '/js/charts.js',
    '/assets/logo.png',
    '/manifest.json',
    '/offline.html',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(ASSETS);
            })
    );
});

// تنشيط Service Worker
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// معالجة الطلبات
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // إرجاع الاستجابة المخزنة مؤقتًا إذا وجدت
                if (response) {
                    return response;
                }
                
                // إذا لم توجد في التخزين المؤقت، حاول جلبها من الشبكة
                return fetch(event.request)
                    .then((response) => {
                        // إذا كانت الاستجابة غير صالحة، لا تخزنها
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // نسخ الاستجابة وتخزينها في ذاكرة التخزين المؤقت
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        // في حالة الفشل (مثال: عدم الاتصال بالإنترنت)، عرض صفحة عدم الاتصال
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }
                    });
            })
    );
});