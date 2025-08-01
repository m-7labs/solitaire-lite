const CACHE_NAME = 'solitaire-pwa-v1.0.0';
const OFFLINE_URL = './index.html';

// Assets to cache for offline functionality
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './src/gameManager.js',
    './src/gameLogic.js',
    './src/ui.js',
    './favicon.ico'
];

// Dynamic cache for runtime assets
const RUNTIME_CACHE = 'solitaire-runtime-v1.0.0';

/**
 * Service Worker Installation
 * Pre-cache essential assets for offline functionality
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Pre-caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // Force activation of new service worker
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Pre-cache failed:', error);
            })
    );
});

/**
 * Service Worker Activation
 * Clean up old caches and claim all clients
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old caches that don't match current version
                        if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                // Claim all clients to activate immediately
                return self.clients.claim();
            })
            .catch((error) => {
                console.error('Service Worker: Activation failed:', error);
            })
    );
});

/**
 * Network Request Interception
 * Implement cache-first strategy with network fallback
 */
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        handleFetchRequest(event.request)
    );
});

/**
 * Handle fetch requests with advanced caching strategy
 */
async function handleFetchRequest(request) {
    const url = new URL(request.url);

    try {
        // For HTML requests, use network-first strategy for freshness
        if (request.headers.get('accept')?.includes('text/html')) {
            return await networkFirstStrategy(request);
        }

        // For static assets (JS, CSS, images), use cache-first strategy
        if (isStaticAsset(url.pathname)) {
            return await cacheFirstStrategy(request);
        }

        // For other requests, use network-first with cache fallback
        return await networkFirstStrategy(request);

    } catch (error) {
        console.error('Service Worker: Fetch failed:', error);

        // Return offline page for navigation requests if available
        if (request.headers.get('accept')?.includes('text/html')) {
            const offlineResponse = await caches.match(OFFLINE_URL);
            return offlineResponse || new Response('Offline', { status: 503 });
        }

        // Return generic offline response for other requests
        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * Cache-first strategy: Check cache first, then network
 */
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        // Update cache in background for next time
        updateCacheInBackground(request);
        return cachedResponse;
    }

    // If not in cache, fetch from network and cache it
    const networkResponse = await fetch(request);
    await cacheResponse(request, networkResponse.clone(), RUNTIME_CACHE);
    return networkResponse;
}

/**
 * Network-first strategy: Try network first, fallback to cache
 */
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);

        // Cache successful responses for future offline use
        if (networkResponse.ok) {
            await cacheResponse(request, networkResponse.clone(), RUNTIME_CACHE);
        }

        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

/**
 * Update cache in background without blocking response
 */
function updateCacheInBackground(request) {
    // Don't await this - let it run in background
    fetch(request)
        .then(response => {
            if (response.ok) {
                return cacheResponse(request, response, RUNTIME_CACHE);
            }
        })
        .catch(error => {
            console.log('Background cache update failed:', error);
        });
}

/**
 * Cache a response with error handling
 */
async function cacheResponse(request, response, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        await cache.put(request, response);
    } catch (error) {
        console.error('Failed to cache response:', error);
    }
}

/**
 * Check if a pathname represents a static asset
 */
function isStaticAsset(pathname) {
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
    return staticExtensions.some(ext => pathname.endsWith(ext));
}

/**
 * Handle background sync for game state persistence
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'save-game-state') {
        event.waitUntil(syncGameState());
    }
});

/**
 * Sync game state when connection is restored
 */
async function syncGameState() {
    try {
        // Game state is already saved to localStorage by the game
        // This could be extended to sync to a remote server
        console.log('Game state sync completed');
    } catch (error) {
        console.error('Game state sync failed:', error);
    }
}

/**
 * Handle push notifications (for future feature)
 */
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const options = {
        body: event.data.text(),
        icon: './favicon.ico',
        badge: './favicon.ico',
        vibrate: [200, 100, 200],
        tag: 'solitaire-notification',
        actions: [
            {
                action: 'play',
                title: 'Play Now',
                icon: './favicon.ico'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Solitaire', options)
    );
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'play') {
        event.waitUntil(
            clients.openWindow('./')
        );
    }
});

/**
 * Message handling for communication with main thread
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'SKIP_WAITING':
                self.skipWaiting();
                break;

            case 'GET_VERSION':
                event.ports[0].postMessage({ version: CACHE_NAME });
                break;

            case 'CLEAR_CACHE':
                clearAllCaches().then(() => {
                    event.ports[0].postMessage({ success: true });
                });
                break;

            default:
                console.log('Unknown message type:', event.data.type);
        }
    }
});

/**
 * Clear all caches (for debugging/reset)
 */
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('All caches cleared');
}

console.log('Service Worker: Script loaded');