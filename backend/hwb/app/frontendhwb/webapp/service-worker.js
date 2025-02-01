const CACHE_NAME = "harzer-wander-buddy-cache-v1";
const APP_SHELL_FILES = [
    "/", // Root
    "/index.html",
    "/manifest.json",
    "/service-worker.js",
    "/images/BuddyWithMap.webp",
    "/images/icons/BuddyWithMap-192.webp",
    "/images/icons/BuddyWithMap-512.webp",
    "/css/style.css",
    "/js/app.js",
    "/js/init.js",
    "https://openui5.hana.ondemand.com/resources/sap-ui-core.js"
].map( e => e.startsWith("h") ? e : "/frontendhwb/dist" + e);

// Install event - Caches important files for offline use
self.addEventListener("install", event => {
    console.log("[Service Worker] Installing...");
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log("[Service Worker] Caching app shell...");
            return cache.addAll(APP_SHELL_FILES);
        })
    );
    self.skipWaiting(); // Activate immediately
});

// Activate event - Removes old caches when a new service worker is activated
self.addEventListener("activate", event => {
    console.log("[Service Worker] Activating...");
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cache => cache !== CACHE_NAME)
                    .map(cache => {
                        console.log("[Service Worker] Deleting old cache:", cache);
                        return caches.delete(cache);
                    })
            );
        })
    );
    self.clients.claim(); // Take control of pages immediately
});

// Fetch event - Serve cached content when offline
self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;

    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                console.log("[Service Worker] Serving from cache:", event.request.url);
                return response;
            }

            console.log("[Service Worker] Fetching from network:", event.request.url);
            return fetch(event.request).then(networkResponse => {
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }

                // Cache new requests dynamically
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            });
        }).catch(() => {
            console.log("[Service Worker] Network unavailable, showing fallback content.");
            return caches.match("/index.html");
        })
    );
});
