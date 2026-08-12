// ============================================================
// GM Recursos Humanos - Service Worker v15
// Estrategia: Network First para todo el codigo (HTML y JS),
// Cache First solo para recursos que no cambian (iconos, fuentes).
//
// POR QUE v15: la version anterior decidia la estrategia con una
// LISTA de rutas ('/', '/index.html', '/main.js'). Cualquier pagina
// que no estuviera en esa lista (por ejemplo /nom035) caia en
// "cache primero" y quedaba congelada para siempre: el navegador
// servia la copia guardada sin volver a consultar al servidor
// jamas. Una lista de rutas escritas a mano siempre se queda
// corta. Ahora la regla es estructural: si es una navegacion o
// termina en .html / .js, va por red.
// ============================================================

const CACHE_NAME = 'prisma-rh-v102';

const ASSETS_ESTATICOS = [
  '/manifest.json',
  '/icon.svg'
];

// -- Instalacion: solo assets que no cambian --
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_ESTATICOS))
      .then(() => self.skipWaiting())
  );
});

// -- Activacion: borrar cachés anteriores --
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// -- Fetch --
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // No interceptar el backend ni APIs externas
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('groq.com') ||
      event.request.method !== 'GET') {
    return;
  }

  // Solo manejamos lo que sirve nuestro propio dominio.
  // Los CDN (Tailwind, Font Awesome) traen su propio cacheo.
  if (url.origin !== self.location.origin) return;

  // NETWORK FIRST para todo el codigo de la app.
  //
  // event.request.mode === 'navigate' cubre cualquier pagina que el
  // usuario abra escribiendo la URL o siguiendo un enlace, tenga o
  // no extension .html (Cloudflare Pages sirve /nom035 sin ella,
  // que es exactamente lo que se nos escapaba antes).
  const esCodigo = event.request.mode === 'navigate' ||
                   url.pathname === '/' ||
                   url.pathname.endsWith('.html') ||
                   url.pathname.endsWith('.js');

  if (esCodigo) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response && response.status === 200) {
            const copia = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia));
          }
          return response;
        })
        .catch(() => {
          // Sin red: la copia guardada es un respaldo, no la fuente
          return caches.match(event.request)
            .then(cached => cached || new Response(
              '<h1>Sin conexion</h1><p>Revisa tu red e intenta de nuevo.</p>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            ));
        })
    );
    return;
  }

  // CACHE FIRST para lo demas (iconos, imagenes, fuentes)
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

// -- Mensaje desde la app: forzar actualizacion --
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
