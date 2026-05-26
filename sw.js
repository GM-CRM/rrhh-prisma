// ============================================================
//  GM Recursos Humanos — Service Worker v14
//  Estrategia: Network First
//  Siempre intenta obtener la versión más reciente del servidor.
//  Solo usa caché como fallback si no hay red disponible.
// ============================================================

const CACHE_NAME = 'prisma-rh-v35';
const ASSETS_ESTATICOS = [
    '/manifest.json',
    '/icon.svg'
];

// ── Instalación: cachear solo assets estáticos que no cambian ─
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_ESTATICOS))
            .then(() => self.skipWaiting()) // activar inmediatamente
    );
});

// ── Activación: eliminar cachés anteriores ────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim()) // tomar control inmediato
    );
});

// ── Fetch: Network First ──────────────────────────────────────
// Para index.html y app.js: SIEMPRE va a la red primero.
// Si la red falla, usa el caché como respaldo.
// Para otros assets: caché primero (imágenes, fuentes, etc.)
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // No interceptar peticiones al GAS ni a APIs externas
    if (url.hostname.includes('script.google.com') ||
        url.hostname.includes('googleapis.com')    ||
        url.hostname.includes('groq.com')          ||
        url.hostname.includes('vision.googleapis.com') ||
        event.request.method !== 'GET') {
        return;
    }

    // Para HTML y JS: Network First (siempre la versión más reciente)
    const esAppShell = url.pathname === '/' ||
                       url.pathname === '/index.html' ||
                       url.pathname.startsWith('/main.js');

    if (esAppShell) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' }) // forzar red, sin caché del browser
                .then(response => {
                    // Guardar copia fresca en caché
                    if (response && response.status === 200) {
                        const copia = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia));
                    }
                    return response;
                })
                .catch(() => {
                    // Sin red → usar caché
                    return caches.match(event.request)
                        .then(cached => cached || new Response('Sin conexión', { status: 503 }));
                })
        );
        return;
    }

    // Para otros recursos: caché primero, luego red
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const copia = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia));
                }
                return response;
            });
        })
    );
});

// ── Mensaje desde la app: forzar actualización ────────────────
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
