/**
 * Multracks Service Worker
 * Provides offline functionality and caching for PWA
 */

// Dynamic versioning using timestamp for automatic cache updates
const VERSION = Date.now();
const CACHE_NAME = `wmult-v${VERSION}`;
const STATIC_CACHE = `wmult-static-v${VERSION}`;
const DYNAMIC_CACHE = `multracks-dynamic-v${VERSION}`;

// Assets to cache on install (PWA only - NOT the track editor)
const STATIC_ASSETS = [
    './',
    './index.html',
    './planos.html',
    './sucesso.html',
    './equipewtracks.html',
    './styles.css',
    './mobile.css',
    './storage.js',
    './audiostorage.js',
    './player.js',
    './app.js',
    './setlists.js',
    './manifest-pc.json',
    './manifest-mobile.json',
    './icon-black-transparent.png',
    './icon-white-transparent.png'
    // NOTE: track-editor.html and track-editor.js are NOT cached
    // to ensure the editor always loads fresh and independently
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[PWA] Service Worker instalando...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[PWA] Cache aberto:', STATIC_CACHE);
                console.log('[PWA] Caching static assets:', STATIC_ASSETS.length, 'arquivos');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[PWA] Static assets cacheados com sucesso');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[PWA] Erro ao cachear static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[PWA] Service Worker ativando...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                console.log('[PWA] Caches existentes:', cacheNames);
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('[PWA] Deletando cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[PWA] Limpeza de caches concluída');
                return self.clients.claim();
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

    // IMPORTANT: Track editor is ALWAYS network-first, never cached
    // This ensures the editor loads fresh and independently from PWA state
    if (url.pathname.includes('track-editor.html') || url.pathname.includes('track-editor.js')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (!networkResponse.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return networkResponse;
                })
                .catch((error) => {
                    console.error('[SW] Track editor fetch failed:', error);
                    throw error;
                })
        );
        return;
    }

    // For static assets, use network-first strategy for immediate updates
    if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Always update cache with fresh content
                    if (networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(STATIC_CACHE).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Fallback to cache if network fails
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
