/**
 * NetChat Live — Progressive Web App Service Worker
 *
 * Implements minimal PWA lifecycle events to satisfy installability
 * while using network pass-through to ensure WebSocket/Socket.IO real-time
 * communication and REST endpoints function without caching interference.
 */

const CACHE_NAME = 'netchat-v4';

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge any outdated caches to discard stale manifests/icons
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Transparent network pass-through: direct request to network
  // preserving WebSocket upgrades, Socket.IO polling, and file streams
  event.respondWith(fetch(event.request));
});
