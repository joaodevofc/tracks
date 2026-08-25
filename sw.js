/**
 * Multracks Service Worker
 * Provides offline functionality and caching for PWA
 */

const CACHE_NAME = 'wmult-v4'; // Incremented version to force cache update
const STATIC_CACHE = 'wmult-static-v4'; // Incremented version to force cache update
const DYNAMIC_CACHE = 'multracks-dynamic-v4'; // Incremented version to force cache update

// Assets to cache on install
const STATIC_ASSETS = [
    '/tracks/',
    '/tracks/index.html',
    '/tracks/styles.css',
    '/tracks/storage.js',
    '/tracks/player.js',
    '/tracks/app.js',
    '/tracks/manifest.json',
    '/tracks/icon-black-transparent.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing new service worker');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Skipping waiting to activate immediately');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating new service worker');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Claiming all clients');
                return self.clients.claim();
            })
            .then(() => {
                // Notify all clients about the update
                return self.clients.matchAll();
            })
            .then((clients) => {
                console.log('[SW] Notifying', clients.length, 'clients about update');
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SW_UPDATE_AVAILABLE',
                        message: 'New version available, reloading...'
                    });
                });
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip chrome extensions and other protocols
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Skip audio streaming endpoints - let them pass directly to network
    // These use Range requests and should not be cached by Service Worker
    if (url.pathname.match(/^\/track\/[^/]+\/stream$/)) {
        console.log('[SW] Skipping audio stream URL:', url.pathname);
        return; // Let browser handle it directly without SW interception
    }
    
    // For static assets (JS, CSS, HTML), use network-first with aggressive cache busting
    if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' }) // Bypass browser cache
                .then((networkResponse) => {
                    // Always update cache with fresh content
                    if (networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(STATIC_CACHE).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                        console.log('[SW] Fresh content loaded from network:', url.pathname);
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Fallback to cache if network fails
                    console.log('[SW] Network failed, using cache for:', url.pathname);
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // For requests to /tracks/ path, use network-first strategy
    if (url.pathname.startsWith('/tracks/')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Cache successful responses
                    if (networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(DYNAMIC_CACHE).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // If network fails, try cache
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // For other requests, use network-first strategy
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Cache successful responses
                if (networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If network fails, try cache
                return caches.match(event.request);
            })
    );
});

// Handle background sync for future implementation
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-projects') {
        event.waitUntil(syncProjects());
    }
});

// Handle push notifications for future implementation
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'Nova atualização disponível',
        icon: '/data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23000000\'/><text y=\'.9em\' font-size=\'90\'>🎵</text></svg>',
        badge: '/data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23000000\'/><text y=\'.9em\' font-size=\'90\'>🎵</text></svg>',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('W.Tracks', options)
    );
});

// Sync projects function for future implementation
function syncProjects() {
    return Promise.resolve();
}
