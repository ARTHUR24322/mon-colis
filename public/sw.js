// Moncolis PWA Service Worker v2
const CACHE_NAME = 'moncolis-v2';
const OFFLINE_URL = '/offline.html';

// Fichiers statiques minimaux mis en cache pour le fonctionnement hors ligne
const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache installation warning:', err);
      });
    })
  );
  // Forcer l'activation immédiate du nouveau service worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          // Supprimer systématiquement les anciens caches comme moncolis-v1
          if (name !== CACHE_NAME) {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  // Prendre le contrôle immédiat de tous les onglets ouverts
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Laisser le réseau gérer les requêtes non-GET et les appels API
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // Pour les navigations de page (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          // Renvoyer la page dédiée hors-ligne, JAMAIS une ancienne page d'accueil en cache
          const offlineFallback = await cache.match(OFFLINE_URL);
          return offlineFallback || new Response('Hors ligne', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Pour les autres ressources (images, styles, scripts)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);
        return cachedResponse || Response.error();
      })
  );
});
