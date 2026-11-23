// Cada versión toma todos sus recursos de la misma caché. El worker anterior
// sigue atendiendo la app hasta que la instalación de la nueva esté completa.
// scripts/preparar-publicacion.cjs fija una ruta y una huella para el árbol servido.
const PUBLICACION = null;
const CACHE = PUBLICACION?.cache || 'pos-v2.37';
// Generada con node pruebas/pwa/huella.cjs al preparar la publicación.
const HUELLA_APP = '1faa3ad119c4fc30365520c7927015f18a65d9bc5bd0838e1b26fe905831789b';
const ANTERIOR = 'pos-v2.35';
const LIBS = 'libs-v1';
const FOTOS = 'fotos-v1';
const DATOS = 'pos-datos-v1';
const SHELL = [
  'index.html', 'config.js', 'manifest.webmanifest',
  'icono-192.png', 'icono-512.png', 'icono-maskable-512.png', 'apple-touch-icon.png', 'logo-carrito.png',
  'css/base.css', 'css/componentes.css', 'css/material.css', 'css/stock.css', 'css/tokens.css',
  'js/app.js', 'js/arranque-pwa.js', 'js/principal.js', 'js/ui.js', 'js/version.js',
  'js/datos/contrato.js', 'js/datos/dispositivo.js', 'js/datos/eventos.js', 'js/datos/firebase.js',
  'js/datos/github-fotos.js', 'js/datos/index.js', 'js/datos/memoria.js', 'js/datos/pendientes.js',
  'js/datos/semilla.js', 'js/datos/tasa-remota.js', 'js/datos/vivos.js',
  'js/nucleo/busqueda.js', 'js/nucleo/caja.js', 'js/nucleo/cobro.js', 'js/nucleo/colores.js',
  'js/nucleo/comisiones.js', 'js/nucleo/costos.js', 'js/nucleo/descuento.js', 'js/nucleo/dinero.js', 'js/nucleo/ejemplos.js',
  'js/nucleo/fechas.js', 'js/nucleo/formas.js', 'js/nucleo/fotos.js', 'js/nucleo/importar.js',
  'js/nucleo/permisos.js', 'js/nucleo/producto.js', 'js/nucleo/recibo.js', 'js/nucleo/reportes.js',
  'js/nucleo/tasas.js', 'js/nucleo/tipo-prenda.js', 'js/nucleo/tramos.js', 'js/nucleo/una-vez.js',
  'js/vistas/actividad.js', 'js/vistas/ajustes.js', 'js/vistas/apartados.js', 'js/vistas/caja.js',
  'js/vistas/calculadora.js', 'js/vistas/calendario.js', 'js/vistas/cliente.js', 'js/vistas/cobrar.js',
  'js/vistas/cobro-abierto.js', 'js/vistas/conflictos.js', 'js/vistas/cuenta.js', 'js/vistas/entrar.js',
  'js/vistas/escaner.js', 'js/vistas/inicio.js', 'js/vistas/inventario.js', 'js/vistas/mas.js',
  'js/vistas/pagos.js', 'js/vistas/recorte.js', 'js/vistas/reporte-cierre.js', 'js/vistas/reportes.js',
  'js/vistas/usuarios.js', 'js/vistas/vender.js', 'js/vistas/venta-en-curso.js', 'js/vistas/ventas-rango.js',
];
// Los iconos y el manifiesto conservan sus URL porque identifican la misma PWA.
const rutaPublicada = ruta => PUBLICACION && /^(?:index\.html$|config\.js$|(?:js|css)\/)/.test(ruta)
  ? PUBLICACION.prefijo + ruta : ruta;
const URL_INICIO = new URL(rutaPublicada('index.html'), self.registration.scope);
const RECURSOS = SHELL.map(ruta => ({ ruta, url: new URL(rutaPublicada(ruta), self.registration.scope).href }));
const URLS_APP = new Set(RECURSOS.map(r => r.url));
const RESPUESTA_SIN_APP = () => new Response('Recursos de la aplicación no disponibles.', { status: 503 });

async function sha256(datos) {
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function verificarTipo(ruta, respuesta) {
  const tipo = respuesta.headers.get('content-type') || '';
  const esperado = ruta.endsWith('.js') ? /javascript|ecmascript/i
    : ruta.endsWith('.css') ? /^text\/css\b/i : ruta === 'index.html' ? /^text\/html\b/i : null;
  if (esperado && !esperado.test(tipo)) throw new Error('Tipo de recurso inesperado: ' + ruta);
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const recursos = await Promise.all(RECURSOS.map(async ({ ruta, url }) => {
      const respuesta = await fetch(url, { cache: 'reload' });
      if (!respuesta.ok || respuesta.redirected) throw new Error('Recurso no disponible: ' + ruta);
      verificarTipo(ruta, respuesta);
      const firma = await sha256(await respuesta.clone().arrayBuffer());
      return { url, respuesta, firma: ruta + '\0' + firma + '\n' };
    }));
    const firmas = recursos.map(r => r.firma).join('');
    if (await sha256(new TextEncoder().encode(firmas)) !== (PUBLICACION?.huella || HUELLA_APP)) {
      throw new Error('El servidor todavía no tiene todos los recursos de esta publicación');
    }

    // El conjunto se descarga y verifica antes de escribir. Una nueva instalación
    // de la misma publicación solo puede escribir los mismos bytes.
    const existia = await caches.has(CACHE);
    const cache = await caches.open(CACHE);
    const escrituras = await Promise.allSettled(recursos.map(({ url, respuesta }) => cache.put(url, respuesta)));
    if (escrituras.some(r => r.status === 'rejected')) {
      if (!existia) await caches.delete(CACHE);
      throw new Error('No se pudo guardar la publicación completa');
    }
  })());
});

self.addEventListener('message', e => {
  // El protocolo heredado no prueba que las pestañas hayan resguardado su trabajo.
  if (e.data === 'activar') e.source?.postMessage('actualizacion-aplazada');
});

self.addEventListener('activate', e => {
  // En una actualización, la siguiente navegación toma el worker nuevo. Evita
  // reclamar otros documentos antiguos, que podrían recargar al cambiar de controlador.
  e.waitUntil((async () => {
    const anteriores = (await caches.keys()).some(k => k.startsWith('pos-v') && k !== CACHE);
    if (!anteriores) await self.clients.claim();
  })());
});

async function cachePrimero(nombre, peticion) {
  const cache = await caches.open(nombre);
  const guardada = await cache.match(peticion);
  if (guardada) return guardada;
  const respuesta = await fetch(peticion);
  if (respuesta.ok || respuesta.type === 'opaque') await cache.put(peticion, respuesta.clone()).catch(() => {});
  return respuesta;
}

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;

  // La caché de la aplicación es inmutable después de la instalación.
  // Un módulo que falte jamás se sustituye por HTML ni por otra revisión.
  const recurso = u.origin + u.pathname;
  const navegacion = r.mode === 'navigate' && u.href.startsWith(self.registration.scope);
  if (URLS_APP.has(recurso) || navegacion) {
    e.respondWith(caches.open(CACHE).then(c => c.match(navegacion ? URL_INICIO : recurso))
      .then(respuesta => respuesta || RESPUESTA_SIN_APP()));
    return;
  }

  if (u.href.startsWith(self.registration.scope)) {
    const ruta = u.pathname.slice(new URL(self.registration.scope).pathname.length);
    if (/^(?:versiones\/|js\/|css\/|config\.js$)/.test(ruta)) {
      e.respondWith(caches.match(r).then(guardada => guardada || fetch(r)));
      return;
    }
  }

  if ((u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) || u.hostname.startsWith('fonts.g') ||
      (u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/@zxing/library@0.21.3/'))) {
    e.respondWith(cachePrimero(LIBS, r));
    return;
  }
  if (u.pathname.endsWith('.json')) {
    e.respondWith((async () => {
      const cache = await caches.open(DATOS);
      // Las consultas con marca de tiempo comparten la última copia.
      const clave = new URL(r.url);
      clave.searchParams.delete('t');
      try {
        const respuesta = await fetch(r);
        if (respuesta.ok) await cache.put(clave.href, respuesta.clone()).catch(() => {});
        else return (await cache.match(clave.href)) || (await caches.match(r, { cacheName: ANTERIOR, ignoreSearch: true })) || respuesta;
        return respuesta;
      } catch (error) {
        const copia = (await cache.match(clave.href)) || (await caches.match(r, { cacheName: ANTERIOR, ignoreSearch: true }));
        if (copia) return copia;
        throw error;
      }
    })());
    return;
  }
  if (u.origin === self.location.origin && u.pathname.includes('/fotos/')) {
    e.respondWith(cachePrimero(FOTOS, r));
  }
});
