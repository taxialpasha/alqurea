const CACHE_NAME = 'investor-portfolio-v1';
const OFFLINE_URL = '/offline.html';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/offline.html',
    'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/icon.png?alt=media&token=7e824800-0d53-4e7a-9e99-21f73b2a8802',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.1/chart.min.js'
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('تم فتح التخزين المؤقت');
                return cache.addAll(ASSETS);
            })
    );
    self.skipWaiting();
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
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// معالجة الطلبات
self.addEventListener('fetch', (event) => {
    // لا نتعامل مع الطلبات غير HTTP
    if (!event.request.url.startsWith('http')) return;
    
    // استثناء طلبات Firebase لتجنب المشاكل، ولكن السماح بمسار أيقونتنا
    if ((event.request.url.includes('firebaseio.com') || 
         event.request.url.includes('googleapis.com') ||
         event.request.url.includes('gstatic.com')) && 
        !event.request.url.includes('icon.png')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // استخدام النسخة المخزنة إذا كانت متوفرة
                if (response) {
                    return response;
                }
                
                // محاولة جلب المصدر من الشبكة
                return fetch(event.request)
                    .then((response) => {
                        // عدم تخزين استجابات غير صالحة
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        
                        // تخزين نسخة من الاستجابة
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                if (event.request.method === 'GET') {
                                    cache.put(event.request, responseToCache);
                                }
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        // في حالة عدم الاتصال، عرض صفحة عدم الاتصال
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }
                        
                        // للموارد الأخرى مثل الصور، يمكن إضافة صورة بديلة
                        if (event.request.destination === 'image') {
                            // استخدام الأيقونة من كاش إذا كانت متوفرة
                            return caches.match('https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/icon.png?alt=media&token=7e824800-0d53-4e7a-9e99-21f73b2a8802');
                        }
                        
                        return new Response('حدث خطأ في الاتصال', {
                            status: 503,
                            statusText: 'خدمة غير متوفرة',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// معالجة إشعارات الدفع
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'تم استلام إشعار جديد',
            icon: 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/icon.png?alt=media&token=7e824800-0d53-4e7a-9e99-21f73b2a8802',
            badge: 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/icon.png?alt=media&token=7e824800-0d53-4e7a-9e99-21f73b2a8802',
            dir: 'rtl',
            vibrate: [100, 50, 100]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'محفظة المستثمر', options)
        );
    }
});

// معالجة النقر على الإشعارات
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            // إذا كان التطبيق مفتوحًا
            for (const client of windowClients) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            
            // إذا كان التطبيق مغلقًا
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});