// Cada versión toma todos sus recursos de la misma caché. El worker anterior
// sigue atendiendo la app hasta que la instalación de la nueva esté completa.
const CACHE = 'pos-v2.36';
// Generada con node pruebas/pwa/huella.cjs al preparar la publicación.
const HUELLA_APP = 'dc64a46e5e01654c9033329519a07e45ef7d5dc1102b465aac1ab6dabf803b38';
const ANTERIOR = 'pos-v2.35';
const LIBS = 'libs-v1';
const FOTOS = 'fotos-v1';
const DATOS = 'pos-datos-v1';
const SHELL = [
  'index.html', 'config.js', 'manifest.webmanifest',
  'icono-192.png', 'icono-512.png', 'icono-maskable-512.png', 'apple-touch-icon.png', 'logo-carrito.png',
  'css/base.css', 'css/componentes.css', 'css/material.css', 'css/stock.css', 'css/tokens.css',
  'js/app.js', 'js/principal.js', 'js/ui.js', 'js/version.js',
  'js/datos/contrato.js', 'js/datos/dispositivo.js', 'js/datos/eventos.js', 'js/datos/firebase.js',
  'js/datos/github-fotos.js', 'js/datos/index.js', 'js/datos/memoria.js', 'js/datos/pendientes.js',
  'js/datos/semilla.js', 'js/datos/tasa-remota.js', 'js/datos/vivos.js',
  'js/nucleo/busqueda.js', 'js/nucleo/caja.js', 'js/nucleo/cobro.js', 'js/nucleo/colores.js',
  'js/nucleo/comisiones.js', 'js/nucleo/costos.js', 'js/nucleo/descuento.js', 'js/nucleo/dinero.js',
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
const URL_INICIO = new URL('index.html', self.registration.scope);
const URLS_APP = new Set(SHELL.map(ruta => new URL(ruta, self.registration.scope).href));
const RESPUESTA_SIN_APP = () => new Response('Recursos de la aplicación no disponibles.', { status: 503 });

async function sha256(datos) {
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function huellaApp(cache) {
  // config.js se configura por separado. La huella cubre HTML, estilos y módulos.
  const codificador = new TextEncoder();
  const firmas = await Promise.all(SHELL.filter(ruta => /^(?:index\.html$|(?:js|css)\/)/.test(ruta))
    .map(async ruta => {
      const recurso = await cache.match(new URL(ruta, self.registration.scope));
      const contenido = (await recurso.text()).replace(/\r\n/g, '\n');
      return ruta + '\0' + await sha256(codificador.encode(contenido)) + '\n';
    }));
  return sha256(codificador.encode(firmas.join('')));
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      // addAll confirma el lote completo o rechaza la instalación.
      await cache.addAll([...URLS_APP].map(url => new Request(url, { cache: 'reload' })));
      for (const ruta of SHELL) {
        const tipos = ruta.endsWith('.js') ? /javascript|ecmascript/i
          : ruta.endsWith('.css') ? /^text\/css\b/i
          : ruta === 'index.html' ? /^text\/html\b/i : null;
        if (!tipos) continue;
        const recurso = await cache.match(new URL(ruta, self.registration.scope));
        const tipo = recurso.headers.get('content-type') || '';
        if (!tipos.test(tipo)) throw new Error('Tipo de recurso inesperado: ' + ruta);
      }
      const version = await cache.match(new URL('js/version.js', self.registration.scope));
      if (!(await version.text()).includes(`export const APP_VERSION = '${CACHE.slice(4)}'`)) {
        throw new Error('La versión de la app todavía no está disponible');
      }
      if (await huellaApp(cache) !== HUELLA_APP) {
        throw new Error('El servidor todavía no tiene todos los recursos de esta versión');
      }
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});

self.addEventListener('message', e => {
  if (e.data !== 'activar' || !e.source) return;
  e.waitUntil((async () => {
    // v2.35 también envía este mensaje. Activar con otras pestañas abiertas
    // les forzaría una recarga sin comprobar su carrito o su cobro abierto.
    const abiertas = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(c => c.url.startsWith(self.registration.scope));
    if (abiertas.length === 1 && abiertas[0].id === e.source.id) await self.skipWaiting();
    else e.source.postMessage('actualizacion-aplazada');
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Se conserva la caché previa durante esta transición, también para sus JSON.
    const antiguas = (await caches.keys()).filter(k => /^pos-v\d+\.\d+$/.test(k) && k !== CACHE && k !== ANTERIOR);
    await Promise.all(antiguas.map(k => caches.delete(k)));
    await self.clients.claim();
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
