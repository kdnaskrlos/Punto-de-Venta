// node --test pruebas/pwa/regresion-actualizacion.cjs
// Requiere Playwright, Chromium, OpenSSL y el historial de v2.35 en Git.
// POS_CHROMIUM_PATH permite usar Chromium del sistema. POS_PWA_CANDIDATO_DIR
// permite servir otro árbol local, incluido el futuro candidato, sin instalar un puente.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const https = require('node:https');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const REPO = path.resolve(__dirname, '../..');
const CANDIDATO = path.resolve(process.env.POS_PWA_CANDIDATO_DIR || REPO);
const BASE = '1423e187fba3cfe0bda293baaaa26c3350ef7cf2';
const ALCANCE = '/Punto-de-Venta/';
const CACHE_ANTERIOR = 'pos-v2.35';
const AJUSTES = 'js/vistas/ajustes.js';
const MAS = 'js/vistas/mas.js';
const MEMORIA = 'js/datos/memoria.js';
const EJEMPLOS = 'js/nucleo/ejemplos.js';
const BORRADOR = 'pos-venta-admin';
const LISTO = '#app[data-listo="1"]';
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

let temporal, anterior, tls, navegador, versionCandidata;

before(async () => {
  temporal = mkdtempSync(path.join(tmpdir(), 'pos-regresion-'));
  anterior = path.join(temporal, 'anterior');
  mkdirSync(anterior);
  const git = execFileSync('git', ['archive', BASE], { cwd: REPO, maxBuffer: 16 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', anterior], { input: git });
  const cert = path.join(temporal, 'cert.pem');
  const key = path.join(temporal, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' });
  tls = { cert: readFileSync(cert), key: readFileSync(key) };
  versionCandidata = readFileSync(path.join(CANDIDATO, 'js/version.js'), 'utf8')
    .match(/export const APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
  assert.ok(versionCandidata && versionCandidata !== 'v2.35', 'Se requiere un candidato posterior a v2.35');
  navegador = await chromium.launch({
    executablePath: process.env.POS_CHROMIUM_PATH,
    // Prohíbe resolver destinos externos incluso en peticiones de un worker.
    args: ['--ignore-certificate-errors', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost'],
  });
});

after(async () => {
  try {
    await navegador?.close();
  } finally {
    if (temporal) rmSync(temporal, { recursive: true, force: true });
  }
});

function servir(estado, req, res) {
  const { pathname } = new URL(req.url, 'https://localhost');
  if (!pathname.startsWith(ALCANCE)) return res.writeHead(404).end();
  const recurso = pathname.slice(ALCANCE.length) || 'index.html';
  const fallo = estado.fallos.find(f => recurso === f.ruta || recurso.endsWith('/' + f.ruta));
  const raiz = fallo?.tipo === 'obsoleto' ? anterior : estado.raiz;
  const peticion = { recurso, raiz, estado: null };
  estado.peticiones.push(peticion);
  res.setHeader('Cache-Control', 'no-store');

  if (fallo?.tipo === 'corte') {
    // La prueba decide cuándo cortar. El candidato queda a medio descargar.
    const destruirRespuesta = () => {
      peticion.estado = 'corte';
      res.destroy();
    };
    if (fallo.interrumpido) destruirRespuesta();
    else fallo.alPedir(destruirRespuesta);
    return;
  }
  if (fallo?.tipo === 503) {
    peticion.estado = 503;
    return res.writeHead(503).end();
  }

  const archivo = path.resolve(raiz, fallo?.tipo === 'obsoleto' ? fallo.ruta : recurso);
  if (!archivo.startsWith(raiz + path.sep)) return res.writeHead(404).end();
  let bytes;
  try {
    bytes = readFileSync(archivo);
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) throw error;
    peticion.estado = 404;
    return res.writeHead(404).end();
  }
  peticion.estado = 200;
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
  return res.end(bytes);
}

async function escenario(probar) {
  const estado = { raiz: anterior, fallos: [], peticiones: [] };
  const servidor = https.createServer(tls, (req, res) => servir(estado, req, res));
  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolve);
  });
  let contexto;
  try {
    contexto = await navegador.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1530, height: 900 } });
    const ruta = `https://localhost:${servidor.address().port}${ALCANCE}?demo#/ajustes`;
    await probar({ contexto, ruta, estado });
  } finally {
    try {
      await contexto?.close();
    } finally {
      servidor.closeAllConnections();
      await new Promise(resolve => servidor.close(resolve));
    }
  }
}

async function verVersion(pagina, esperada) {
  await pagina.waitForFunction(v => document.querySelector('.ver')?.textContent === v, esperada);
}

async function abrir(env, version) {
  const pagina = await env.contexto.newPage();
  pagina.setDefaultTimeout(10_000);
  await pagina.goto(env.ruta, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector(LISTO);
  await pagina.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await verVersion(pagina, version);
  return pagina;
}

async function esperarCache(pagina, rutas) {
  await pagina.waitForFunction(async ({ nombre, rutas }) => {
    const cache = await caches.open(nombre);
    return (await Promise.all(rutas.map(ruta => cache.match(ruta)))).every(Boolean);
  }, { nombre: CACHE_ANTERIOR, rutas });
}

async function buscar(pagina) {
  return pagina.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    try {
      await reg.update();
    } catch (error) {
      if (!String(error).includes('Failed to update a ServiceWorker')) throw error;
    }
    const candidato = reg.installing;
    if (!candidato) return;
    await new Promise(resolve => {
      function alCambiar() {
        if (!['installed', 'activating', 'activated', 'redundant'].includes(candidato.state)) return;
        candidato.removeEventListener('statechange', alCambiar);
        resolve();
      }
      candidato.addEventListener('statechange', alCambiar);
      alCambiar();
    });
  });
}

async function rechazado(pagina) {
  const estado = await pagina.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return {
      instalando: Boolean(reg.installing),
      esperando: Boolean(reg.waiting),
      caches: (await caches.keys()).filter(k => k.startsWith('pos-v')),
    };
  });
  assert.deepEqual(estado, { instalando: false, esperando: false, caches: [CACHE_ANTERIOR] });
}

async function esperando(pagina) {
  await pagina.waitForFunction(async () => (await navigator.serviceWorker.ready).waiting?.state === 'installed');
  await verVersion(pagina, 'v2.35');
}

async function agregarCarrito(pagina) {
  await pagina.evaluate(() => { location.hash = '/vender'; });
  await pagina.fill('#buscar', 'Jogger Texcol Caballero Negro');
  await pagina.click('.tarjeta-prenda[data-nombre="Jogger Texcol Caballero Negro"]');
  await pagina.click('.capa .talla-mas[data-talla="M"]');
  await pagina.click('#tallas-agregar');
  await pagina.waitForSelector('.linea[data-sku="J-M"]');
}

function leerBorrador(pagina) {
  return pagina.evaluate(clave => JSON.parse(localStorage.getItem(clave)), BORRADOR);
}

async function saltarDesdeUltimaPestana(env, pagina) {
  await pagina.close();
  const nueva = await abrir(env, versionCandidata);
  await nueva.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active === navigator.serviceWorker.controller && !reg.waiting;
  });
  return nueva;
}

async function retomar(pagina) {
  await pagina.click('#retomar-si');
  await pagina.waitForSelector('.linea[data-sku="J-M"]');
  return pagina.evaluate(() => window.__pos.ctx.carrito);
}

const tiempo = { timeout: 60_000 };

test('01 · Arranca v2.35 si falta ejemplos.js mientras se rechaza el candidato', tiempo, () => escenario(async env => {
  const pagina = await abrir(env, 'v2.35');
  await esperarCache(pagina, [AJUSTES, MAS, EJEMPLOS]);
  assert.equal(await pagina.evaluate(async ({ nombre, ruta }) => {
    const cache = await caches.open(nombre);
    return cache.delete(ruta);
  }, { nombre: CACHE_ANTERIOR, ruta: EJEMPLOS }), true, 'Se simuló la pérdida de un solo módulo');

  env.estado.raiz = CANDIDATO;
  env.estado.fallos.push({ ruta: AJUSTES, tipo: 503 });
  await buscar(pagina);
  await rechazado(pagina);
  assert.ok(env.estado.peticiones.some(p => p.estado === 503), 'El rechazo ocurrió durante la precarga');

  const respuesta = pagina.waitForResponse(r => r.url().endsWith('/' + EJEMPLOS));
  const [modulo] = await Promise.all([respuesta, pagina.reload({ waitUntil: 'domcontentloaded' })]);
  assert.equal(modulo.fromServiceWorker(), true);
  const arranco = await pagina.waitForSelector(LISTO).then(() => true, error => {
    if (error.name === 'TimeoutError') return false;
    throw error;
  });
  assert.deepEqual({ http: modulo.status(), arranco }, { http: 200, arranco: true },
    `v2.35 debe recuperar ${EJEMPLOS} desde su URL histórica y arrancar`);
}));

test('02 · Un HTTP 503 deja activo el worker anterior y su caché utilizable sin red', tiempo, () => escenario(async env => {
  const pagina = await abrir(env, 'v2.35');
  await esperarCache(pagina, [AJUSTES, MAS, EJEMPLOS]);
  env.estado.raiz = CANDIDATO;
  env.estado.fallos.push({ ruta: AJUSTES, tipo: 503 });
  await buscar(pagina);
  assert.ok(env.estado.peticiones.some(p => p.estado === 503), 'Se sirvió el 503 al candidato');
  await rechazado(pagina);

  await env.contexto.setOffline(true);
  await pagina.reload();
  await pagina.waitForSelector(LISTO);
  await verVersion(pagina, 'v2.35');
}));

test('03 · Un HTTP 200 obsoleto se rechaza y el worker anterior evita exponer una acción incompatible', tiempo, () => escenario(async env => {
  const pagina = await abrir(env, 'v2.35');
  await pagina.waitForSelector('#modo-prueba');
  await esperarCache(pagina, [AJUSTES, MAS, MEMORIA, EJEMPLOS]);
  env.estado.raiz = CANDIDATO;
  env.estado.fallos.push({ ruta: MAS, tipo: 'obsoleto' }, { ruta: AJUSTES, tipo: 'obsoleto' });
  const inicio = env.estado.peticiones.length;
  await buscar(pagina);
  await rechazado(pagina);
  assert.ok(env.estado.peticiones.slice(inicio).some(p => p.raiz === anterior && p.recurso.endsWith(MAS) && p.estado === 200),
    'El candidato pidió y recibió Más de v2.35 con HTTP 200');

  await pagina.reload();
  await pagina.waitForSelector(LISTO);
  // El worker antiguo entrega primero caché y rellena en segundo plano.
  // Esperar sus bytes exactos asegura que la segunda recarga ejerce la mezcla.
  const memoriaPublicada = readFileSync(path.join(CANDIDATO, MEMORIA), 'utf8');
  await pagina.waitForFunction(async ({ nombre, ruta, bytes }) => {
    const cache = await caches.open(nombre);
    const recurso = await cache.match(ruta);
    return recurso && await recurso.text() === bytes;
  }, { nombre: CACHE_ANTERIOR, ruta: MEMORIA, bytes: memoriaPublicada });
  await pagina.reload();
  await pagina.waitForSelector(LISTO);

  const boton = pagina.locator('#modo-prueba');
  const almacenIncompatible = await pagina.evaluate(() => typeof window.__pos.ctx.almacen.cargarEjemplos !== 'function');
  if (await boton.isVisible() && almacenIncompatible) {
    const error = pagina.waitForEvent('pageerror', { timeout: 3000 }).catch(e => {
      if (e.name === 'TimeoutError') return null;
      throw e;
    });
    await boton.click();
    const fallo = await error;
    assert.fail(fallo?.message || 'Modo prueba sigue accesible con el método eliminado');
  }
}));

test('04 · Cerrar la última pestaña de v2.35 conserva un borrador aún sin retomar', tiempo, () => escenario(async env => {
  const pagina = await abrir(env, 'v2.35');
  await agregarCarrito(pagina);
  await pagina.reload();
  await pagina.waitForSelector('#retomar-si');
  const guardado = await leerBorrador(pagina);
  assert.equal(guardado?.c.lineas[0].sku, 'J-M');

  env.estado.raiz = CANDIDATO;
  await buscar(pagina);
  await esperando(pagina);
  assert.deepEqual(await leerBorrador(pagina), guardado, 'El borrador existe justo antes del cierre');
  const nueva = await saltarDesdeUltimaPestana(env, pagina);
  assert.deepEqual(await leerBorrador(nueva), guardado, 'El cierre de v2.35 no debe eliminar el borrador compartido');
  assert.deepEqual((await retomar(nueva)).lineas, guardado.c.lineas);
}));

test('05 · Cerrar una pestaña vacía de la misma cuenta conserva el borrador de la otra', tiempo, () => escenario(async env => {
  const principal = await abrir(env, 'v2.35');
  const otra = await abrir(env, 'v2.35');
  assert.deepEqual(await Promise.all([principal, otra].map(p => p.evaluate(() => window.__pos.ctx.sesion.usuario))), ['admin', 'admin']);
  assert.equal(await otra.evaluate(() => window.__pos.ctx.carrito?.lineas?.length || 0), 0);
  await principal.bringToFront();
  await agregarCarrito(principal);
  const guardado = await leerBorrador(principal);
  assert.equal(guardado?.c.lineas[0].sku, 'J-M');

  env.estado.raiz = CANDIDATO;
  await buscar(principal);
  await esperando(principal);
  await otra.close();
  assert.deepEqual(await leerBorrador(principal), guardado, 'La pestaña vacía de v2.35 borró el carrito de la misma cuenta');
}));

test('06 · Un corte durante la descarga permite usar v2.35 y reintentar al volver Internet', tiempo, () => escenario(async env => {
  const pagina = await abrir(env, 'v2.35');
  await esperarCache(pagina, [AJUSTES, MAS, EJEMPLOS]);
  await agregarCarrito(pagina);
  const solicitud = Promise.withResolvers();
  const fallo = { ruta: AJUSTES, tipo: 'corte', alPedir: solicitud.resolve, interrumpido: false };
  env.estado.raiz = CANDIDATO;
  env.estado.fallos.push(fallo);
  const intento = buscar(pagina);
  const cortar = await Promise.race([
    solicitud.promise,
    intento.then(() => assert.fail('La instalación terminó antes de que pudiera interrumpirse')),
  ]);
  assert.ok(env.estado.peticiones.some(p => p.raiz === CANDIDATO && p.recurso !== 'sw.js' && p.estado === 200),
    'El candidato recibió recursos antes del corte');
  await env.contexto.setOffline(true);
  fallo.interrumpido = true;
  cortar();
  await intento;
  assert.ok(env.estado.peticiones.some(p => p.estado === 'corte'));
  await rechazado(pagina);

  await pagina.reload();
  await pagina.waitForSelector(LISTO);
  await verVersion(pagina, 'v2.35');
  await retomar(pagina);
  env.estado.fallos = [];
  await env.contexto.setOffline(false);
  await buscar(pagina);
  await esperando(pagina);
  await saltarDesdeUltimaPestana(env, pagina);
}));

test('07 · Las operaciones pendientes conservan sus identificadores durante la activación sin red', tiempo, () => escenario(async env => {
  const pagina = await abrir(env, 'v2.35');
  await agregarCarrito(pagina);
  env.estado.raiz = CANDIDATO;
  await buscar(pagina);
  await esperando(pagina);
  await env.contexto.setOffline(true);

  const pendientes = await pagina.evaluate(async () => {
    const { anotarPendiente, leerPendientes } = await import('./js/datos/pendientes.js');
    const ctx = window.__pos.ctx;
    for (const operacion of [
      { que: 'venta', id: 'venta-sintetica-1' },
      { que: 'apartado', id: 'apartado-sintetico-1' },
      { que: 'abono', id: 'abono-sintetico-1', apartadoId: 'apartado-sintetico-1' },
      { que: 'completar', id: 'venta-sintetica-2', apartadoId: 'apartado-sintetico-1' },
    ]) anotarPendiente(ctx, operacion);
    anotarPendiente({ sesion: { usuario: 'otra-cuenta' } }, { que: 'venta', id: 'venta-sintetica-3' });
    return [leerPendientes('admin'), leerPendientes('otra-cuenta')];
  });
  assert.deepEqual(pendientes.map(lista => lista.map(p => p.id)),
    [['venta-sintetica-1', 'apartado-sintetico-1', 'abono-sintetico-1', 'venta-sintetica-2'], ['venta-sintetica-3']]);

  const nueva = await saltarDesdeUltimaPestana(env, pagina);
  const conservados = await nueva.evaluate(() => ['admin', 'otra-cuenta'].map(u => JSON.parse(localStorage.getItem('pos-pendientes-' + u))));
  assert.deepEqual(conservados, pendientes);
}));

test('08 · Salto directo desde v2.35 al candidato con un carrito activo y sin puente', tiempo, () => escenario(async env => {
  const pagina = await abrir(env, 'v2.35');
  await agregarCarrito(pagina);
  const carrito = await pagina.evaluate(() => {
    const datos = window.__pos.ctx.carrito;
    Object.assign(datos, {
      ventaId: 'venta-sintetica-directa',
      cliente: { nombre: 'Cliente sintético', telefono: '0000000000' },
      pagos: [{ forma: 'efectivo-cop', monto: 5000 }],
    });
    dispatchEvent(new CustomEvent('pos:carrito'));
    return datos;
  });
  assert.deepEqual((await leerBorrador(pagina)).c, carrito);

  // Solo hay dos árboles de publicación. No se sirve ni activa otro worker.
  env.estado.raiz = CANDIDATO;
  await buscar(pagina);
  await esperando(pagina);
  const nueva = await saltarDesdeUltimaPestana(env, pagina);
  const recuperado = await retomar(nueva);
  assert.deepEqual(recuperado.lineas, carrito.lineas);
  assert.deepEqual(recuperado.cliente, carrito.cliente);
  assert.deepEqual(recuperado.pagos, carrito.pagos);
  assert.equal(recuperado.ventaId, carrito.ventaId);
  assert.equal(await nueva.locator('#modo-prueba').count(), 0);
}));
