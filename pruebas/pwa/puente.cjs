// node --test pruebas/pwa/puente.cjs
// Sirve el artefacto de publicación, no el árbol de desarrollo.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { appendFileSync, copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const https = require('node:https');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { chromium, devices } = require('playwright');
const { preparar } = require('../../scripts/preparar-publicacion.cjs');

const RAIZ = path.resolve(__dirname, '../..');
const BASE = '1423e187fba3cfe0bda293baaaa26c3350ef7cf2';
const ALCANCE = '/Punto-de-Venta/';
const EJEMPLOS = 'js/nucleo/ejemplos.js';
const AJUSTES = 'js/vistas/ajustes.js';
const PRINCIPAL = 'js/principal.js';
const VENTA_EN_CURSO = 'js/vistas/venta-en-curso.js';
const BORRADOR = 'pos-venta-admin';
const PENDIENTES = 'pos-pendientes-admin';
const FOTO = 'fotos/img-0003.webp';
const VENTA = 'venta-piloto-sintetica';
const NOMBRE_TIENDA = 'Tienda piloto sintética';
const artefactoAnterior = process.env.POS_PWA_PREVIO_DIR;
const artefactoCandidato = process.env.POS_PWA_CANDIDATO_DIR;
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
  '.webp': 'image/webp',
};
const tiempo = { timeout: 55_000 };
const iniciarChromium = {
  executablePath: process.env.POS_CHROMIUM_PATH,
  args: ['--ignore-certificate-errors', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost'],
};
let temporal, antigua, puente, futura, posterior, infoPuente, infoFutura, tls, browser;

before(async () => {
  temporal = mkdtempSync(path.join(tmpdir(), 'pos-puente-'));
  antigua = path.join(temporal, 'v2.35');
  mkdirSync(antigua);
  execFileSync('tar', ['-x', '-C', antigua], {
    input: execFileSync('git', ['archive', BASE], { cwd: RAIZ, maxBuffer: 16 * 1024 * 1024 }),
  });
  puente = path.join(temporal, 'puente');
  infoPuente = preparar(puente);
  const fuente = path.join(temporal, 'fuente-futura');
  mkdirSync(fuente);
  for (const dir of ['js', 'css', 'fotos']) cpSync(path.join(RAIZ, dir), path.join(fuente, dir), { recursive: true });
  for (const archivo of ['index.html', 'sw.js', 'config.js', 'manifest.webmanifest',
    'apple-touch-icon.png', 'icono-192.png', 'icono-512.png', 'icono-maskable-512.png', 'logo-carrito.png']) {
    copyFileSync(path.join(RAIZ, archivo), path.join(fuente, archivo));
  }
  writeFileSync(path.join(fuente, 'js/version.js'), "export const APP_VERSION = 'v2.37';\n");
  const memoria = 'js/datos/memoria.js';
  appendFileSync(path.join(fuente, memoria), '\n// Compilación futura sintética.\n');
  futura = path.join(temporal, 'publicacion-futura');
  infoFutura = preparar(futura, { fuente, conservar: puente });
  posterior = path.join(temporal, 'reversion');
  assert.deepEqual(preparar(posterior, { conservar: futura }), infoPuente);
  // Preparar el siguiente árbol preserva los recursos versionados que ya se publicaron.
  const previo = infoPuente.prefijo + PRINCIPAL;
  assert.deepEqual(readFileSync(path.join(futura, previo)), readFileSync(path.join(puente, previo)));
  assert.deepEqual(readFileSync(path.join(futura, memoria)), readFileSync(path.join(puente, memoria)));
  assert.match(readFileSync(path.join(futura, infoFutura.prefijo, memoria), 'utf8'), /Compilación futura sintética/);
  const cert = path.join(temporal, 'cert.pem'), key = path.join(temporal, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' });
  tls = { cert: readFileSync(cert), key: readFileSync(key) };
  browser = await chromium.launch(iniciarChromium);
});

after(async () => {
  try { await browser?.close(); }
  finally { if (temporal) rmSync(temporal, { recursive: true, force: true }); }
});

async function escenario(inicial, probar, opciones = {}) {
  const estado = { raiz: inicial, fallos: new Map(), peticiones: [] };
  const server = https.createServer(tls, (req, res) => {
    const url = new URL(req.url, 'https://localhost');
    if (!url.pathname.startsWith(ALCANCE)) return res.writeHead(404).end();
    const ruta = url.pathname.slice(ALCANCE.length) || 'index.html';
    const fallo = estado.fallos.get(ruta);
    const archivo = path.resolve(estado.raiz, ruta);
    if (!archivo.startsWith(estado.raiz + path.sep)) return res.writeHead(404).end();
    const respuesta = { ruta, raiz: estado.raiz, codigo: null, obsoleta: Buffer.isBuffer(fallo) };
    estado.peticiones.push(respuesta);
    res.setHeader('Cache-Control', 'no-store');
    if (fallo === 503) {
      respuesta.codigo = 503;
      return res.writeHead(503).end();
    }
    try {
      const bytes = fallo || readFileSync(archivo);
      respuesta.codigo = 200;
      estado.alResponder?.(respuesta);
      return res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' }).end(bytes);
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) throw error;
      respuesta.codigo = 404;
      return res.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  let contexto;
  try {
    contexto = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1530, height: 900 }, ...opciones });
    const ruta = `https://localhost:${server.address().port}${ALCANCE}?demo#/ajustes`;
    await probar({ contexto, estado, ruta });
  } finally {
    try { await contexto?.close(); }
    finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
}

async function pagina(env) {
  const p = await env.contexto.newPage();
  p.setDefaultTimeout(10_000);
  await p.goto(env.ruta, { waitUntil: 'domcontentloaded' });
  return p;
}

async function operativo(p, version) {
  await p.waitForSelector('#app[data-listo="1"]');
  await p.waitForFunction(v => document.querySelector('.ver')?.textContent === v && Boolean(navigator.serviceWorker.controller), version);
}

async function actualizar(p) {
  await p.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    await reg.update().catch(e => {
      if (!String(e).includes('Failed to update a ServiceWorker')) throw e;
    });
    const nuevo = reg.installing;
    if (nuevo) await new Promise(resolve => {
      const fin = () => {
        if (!['installed', 'activating', 'activated', 'redundant'].includes(nuevo.state)) return;
        nuevo.removeEventListener('statechange', fin);
        resolve();
      };
      nuevo.addEventListener('statechange', fin);
      fin();
    });
  });
}

async function esperando(p) {
  await p.waitForFunction(async () => (await navigator.serviceWorker.ready).waiting?.state === 'installed');
}

async function rechazo(p, cache) {
  assert.deepEqual(await p.evaluate(async nombre => {
    const reg = await navigator.serviceWorker.ready;
    return [Boolean(reg.installing), Boolean(reg.waiting), await caches.has(nombre)];
  }, cache), [false, false, false]);
}

async function borradorActivo(p) {
  await p.evaluate(() => {
    window.__pos.ctx.carrito = {
      lineas: [{ sku: 'J-M', cantidad: 1 }], descuento: null, autorizacion: null,
      ventaId: 'venta-de-prueba',
      apartadoId: 'apartado-de-prueba',
      cliente: { nombre: 'Cliente sintético', telefono: '0000000000' },
      pagos: [{ forma: 'efectivo-cop', monto: 5_000 }],
    };
    dispatchEvent(new CustomEvent('pos:carrito'));
  });
  const d = await leerBorrador(p);
  assert.equal(d?.c.ventaId, 'venta-de-prueba');
  return d.c;
}

async function leerBorrador(p) {
  return p.evaluate(clave => JSON.parse(localStorage.getItem(clave)), BORRADOR);
}

test('El artefacto instala el puente con recursos versionados y abre sin conexión', tiempo, () => escenario(puente, async env => {
  const p = await pagina(env);
  await operativo(p, infoPuente.version);
  assert.ok(env.estado.peticiones.some(r => r.ruta === infoPuente.prefijo + PRINCIPAL && r.codigo === 200));
  assert.ok(!env.estado.peticiones.some(r => /^js\//.test(r.ruta)), 'El puente no carga módulos del grafo histórico');
  await p.waitForSelector('#modo-demo');
  assert.equal(await p.locator('#modo-prueba').count(), 0);
  await env.contexto.setOffline(true);
  await p.reload();
  await operativo(p, infoPuente.version);
  assert.equal(await p.evaluate(() => new URL(location).searchParams.has('demo')), true);
  await p.evaluate(() => { location.hash = '/inventario'; });
  await p.waitForSelector('.vista[data-ruta="/inventario"] .tarjeta-prenda');
}));

test('v2.35 incompleta recupera el módulo histórico al reconectar, aunque el candidato devuelva 503', tiempo, () => escenario(antigua, async env => {
  const p = await pagina(env);
  await operativo(p, 'v2.35');
  await p.waitForFunction(async ruta => Boolean(await (await caches.open('pos-v2.35')).match(ruta)), EJEMPLOS);
  assert.equal(await p.evaluate(async ruta => (await caches.open('pos-v2.35')).delete(ruta), EJEMPLOS), true);
  await env.contexto.setOffline(true);
  const fallida = p.waitForResponse(r => r.url().endsWith('/' + EJEMPLOS));
  const [sinModulo] = await Promise.all([fallida, p.reload({ waitUntil: 'domcontentloaded' })]);
  assert.doesNotMatch(sinModulo.headers()['content-type'] || '', /javascript|ecmascript/);
  assert.equal(await p.locator('#app[data-listo="1"]').count(), 0);

  env.estado.raiz = puente;
  env.estado.fallos.set(infoPuente.prefijo + AJUSTES, 503);
  await env.contexto.setOffline(false);
  const respuesta = p.waitForResponse(r => r.url().endsWith('/' + EJEMPLOS) && r.status() === 200);
  await Promise.all([respuesta, p.reload({ waitUntil: 'domcontentloaded' })]);
  await operativo(p, 'v2.35');
  await actualizar(p);
  assert.ok(env.estado.peticiones.some(r => r.codigo === 503 && r.ruta === infoPuente.prefijo + AJUSTES));
  await rechazo(p, infoPuente.cache);
  await env.contexto.setOffline(true);
  await p.reload();
  await operativo(p, 'v2.35');

  env.estado.fallos.clear();
  await env.contexto.setOffline(false);
  await actualizar(p);
  await esperando(p);
  await p.close();
  await operativo(await pagina(env), infoPuente.version);
}));

test('El candidato rechaza bytes antiguos con HTTP 200 y v2.35 completa sigue utilizable', tiempo, () => escenario(antigua, async env => {
  const p = await pagina(env);
  await operativo(p, 'v2.35');
  env.estado.raiz = puente;
  const ruta = infoPuente.prefijo + AJUSTES;
  env.estado.fallos.set(ruta, readFileSync(path.join(antigua, AJUSTES)));
  await actualizar(p);
  assert.ok(env.estado.peticiones.some(r => r.ruta === ruta && r.codigo === 200 && r.obsoleta));
  await rechazo(p, infoPuente.cache);
  await env.contexto.setOffline(true);
  await p.reload();
  await operativo(p, 'v2.35');
}));

test('El arranque PWA reintenta al volver Internet aunque falte el módulo principal', tiempo, () => escenario(puente, async env => {
  env.estado.fallos.set(infoPuente.prefijo + PRINCIPAL, 503);
  const intento = Promise.withResolvers();
  env.estado.alResponder = r => { if (r.ruta === 'sw.js') intento.resolve(); };
  const p = await pagina(env);
  await intento.promise;
  await p.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !reg || (!reg.installing && !reg.active);
  });
  assert.equal(await p.locator('#app[data-listo="1"]').count(), 0);

  const peticiones = env.estado.peticiones.length;
  await env.contexto.setOffline(true);
  env.estado.fallos.clear();
  await env.contexto.setOffline(false);
  await p.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  assert.ok(env.estado.peticiones.slice(peticiones).some(r => r.ruta === 'sw.js' && r.codigo === 200));
  await p.reload();
  await operativo(p, infoPuente.version);
}));

test('El puente conserva el borrador al cerrar pestañas vacías y protege un diálogo desactualizado', tiempo, () => escenario(puente, async env => {
  const principal = await pagina(env);
  await operativo(principal, infoPuente.version);
  const otra = await pagina(env);
  await operativo(otra, infoPuente.version);
  await principal.bringToFront();
  const c = await borradorActivo(principal);
  await otra.evaluate(() => {
    window.__pos.ctx.carrito = { lineas: [] };
    dispatchEvent(new CustomEvent('pos:carrito'));
  });
  await otra.close();
  assert.deepEqual((await leerBorrador(principal)).c, c);

  await env.contexto.setOffline(true);
  await principal.reload();
  await principal.waitForSelector('#retomar-si');
  const dialogoAnterior = await pagina(env);
  await dialogoAnterior.waitForSelector('#retomar-si');
  await principal.click('#retomar-si');
  await principal.waitForFunction(() => window.__pos.ctx.carrito?.ventaId === 'venta-de-prueba');
  await dialogoAnterior.click('#retomar-no');
  assert.deepEqual((await leerBorrador(principal)).c, c);
  await dialogoAnterior.close();

  await principal.reload();
  await principal.waitForSelector('#retomar-si');
  await principal.close();
  const nueva = await pagina(env);
  await nueva.waitForSelector('#retomar-si');
  assert.deepEqual((await leerBorrador(nueva)).c, c);
}));

test('El puente espera con trabajo y varias pestañas; la siguiente versión conserva borradores y pendientes offline', tiempo, () => escenario(puente, async env => {
  const p = await pagina(env);
  await operativo(p, infoPuente.version);
  const otra = await pagina(env);
  await operativo(otra, infoPuente.version);
  await p.bringToFront();
  const c = await borradorActivo(p);
  env.estado.raiz = futura;
  await actualizar(p);
  await esperando(p);
  await p.waitForSelector('.toast.version');
  await p.evaluate(async () => (await navigator.serviceWorker.ready).waiting.postMessage('activar'));
  await otra.close();
  // Tampoco se fuerza el protocolo antiguo cuando queda un solo documento.
  const respuesta = await p.evaluate(async () => {
    const sw = navigator.serviceWorker;
    const reg = await sw.ready;
    return new Promise(resolve => {
      sw.addEventListener('message', e => resolve(e.data), { once: true });
      reg.waiting.postMessage('activar');
    });
  });
  assert.equal(respuesta, 'actualizacion-aplazada');
  await esperando(p);
  await operativo(p, infoPuente.version);
  await env.contexto.setOffline(true);
  const pendientes = [{ que: 'abono', id: 'abono-sintetico', apartadoId: c.apartadoId }, { que: 'venta', id: c.ventaId }];
  await p.evaluate(({ clave, pendientes }) => localStorage.setItem(clave, JSON.stringify(pendientes)), { clave: PENDIENTES, pendientes });
  await p.close();

  const nueva = await pagina(env);
  await operativo(nueva, infoFutura.version);
  await nueva.waitForSelector('#retomar-si');
  assert.deepEqual((await leerBorrador(nueva)).c, c);
  assert.deepEqual(await nueva.evaluate(clave => JSON.parse(localStorage.getItem(clave)), PENDIENTES), pendientes);
}));

test('v2.35 salta directamente a una publicación futura con un carrito resguardado', tiempo, () => escenario(antigua, async env => {
  const p = await pagina(env);
  await operativo(p, 'v2.35');
  const c = await borradorActivo(p);
  env.estado.raiz = futura;
  await actualizar(p);
  await esperando(p);
  await p.close();
  const nueva = await pagina(env);
  await operativo(nueva, infoFutura.version);
  await nueva.click('#retomar-si');
  const recuperado = await nueva.evaluate(() => window.__pos.ctx.carrito);
  assert.deepEqual(recuperado, c);
  assert.ok(!env.estado.peticiones.some(r => r.raiz === puente || r.ruta.startsWith(infoPuente.prefijo)));
}));

test('v2.35 retoma un borrador antes de cerrar la última pestaña y lo conserva al actualizar', tiempo, () => escenario(antigua, async env => {
  const p = await pagina(env);
  await operativo(p, 'v2.35');
  const carrito = await borradorActivo(p);
  await p.reload();
  await p.waitForSelector('#retomar-si');
  await esperarActualizacionDesdeV235(env, p);

  await p.click('#retomar-si');
  await p.waitForFunction(id => window.__pos.ctx.carrito?.ventaId === id, carrito.ventaId);
  await comprobarBorradorTrasCerrar(env, p, carrito);
}));

test('v2.35 conserva el carrito activo al cerrar primero la pestaña vacía y finalmente actualizar', tiempo, () => escenario(antigua, async env => {
  const p = await pagina(env);
  await operativo(p, 'v2.35');
  const vacia = await pagina(env);
  await operativo(vacia, 'v2.35');
  assert.deepEqual(await Promise.all([p, vacia].map(pag => pag.evaluate(() => window.__pos.ctx.sesion.usuario))), ['admin', 'admin']);
  assert.equal(await vacia.evaluate(() => window.__pos.ctx.carrito?.lineas?.length || 0), 0);
  await p.bringToFront();
  const carrito = await borradorActivo(p);
  await esperarActualizacionDesdeV235(env, p);

  await vacia.close();
  assert.deepEqual(await p.evaluate(() => window.__pos.ctx.carrito), carrito);
  await comprobarBorradorTrasCerrar(env, p, carrito);
}));

test('El módulo histórico del puente protege la pestaña cuando v2.35 lo carga por red', tiempo, () => escenario(antigua, async env => {
  const p = await pagina(env);
  await operativo(p, 'v2.35');
  const bytes = readFileSync(path.join(puente, VENTA_EN_CURSO), 'utf8');
  assert.notEqual(bytes, readFileSync(path.join(antigua, VENTA_EN_CURSO), 'utf8'));
  env.estado.raiz = puente;
  env.estado.fallos.set(infoPuente.prefijo + AJUSTES, 503);
  await actualizar(p);
  await rechazo(p, infoPuente.cache);
  // El worker antiguo vuelve a descargar su módulo en segundo plano. Las
  // recargas se hacen antes de abrir un borrador y consumen la copia renovada.
  await p.reload();
  await p.waitForFunction(async ({ ruta, bytes }) => {
    const cache = await caches.open('pos-v2.35');
    return (await (await cache.match(ruta))?.text()) === bytes;
  }, { ruta: VENTA_EN_CURSO, bytes });
  await p.reload();
  await operativo(p, 'v2.35');
  const vacia = await pagina(env);
  await operativo(vacia, 'v2.35');
  await p.bringToFront();
  const carrito = await borradorActivo(p);
  await p.reload();
  await p.waitForSelector('#retomar-si');
  const guardado = await leerBorrador(p);
  assert.deepEqual(guardado.c, carrito);
  await vacia.close();
  assert.deepEqual(await leerBorrador(p), guardado);

  env.estado.fallos.clear();
  await esperarActualizacionDesdeV235(env, p);
  await comprobarBorradorTrasCerrar(env, p, carrito);
}));

async function esperarActualizacionDesdeV235(env, p) {
  env.estado.raiz = puente;
  await actualizar(p);
  await esperando(p);
  await operativo(p, 'v2.35');
}

async function comprobarBorradorTrasCerrar(env, p, carrito) {
  await env.contexto.setOffline(true);
  await p.close();
  const nueva = await pagina(env);
  await operativo(nueva, infoPuente.version);
  assert.deepEqual((await leerBorrador(nueva)).c, carrito);
  await nueva.click('#retomar-si');
  assert.deepEqual(await nueva.evaluate(() => window.__pos.ctx.carrito), carrito);
}

test('Las llamadas históricas se rechazan sin cambiar datos del almacén', tiempo, () => escenario(antigua, async env => {
  const p = await pagina(env);
  await operativo(p, 'v2.35');
  env.estado.raiz = puente;
  // Carga explícita de las URL que conserva la publicación en el árbol histórico.
  const resultado = await p.evaluate(async () => {
    const { crearMemoria } = await import('./js/datos/memoria.js?compatibilidad');
    const { generarEjemplos } = await import('./js/nucleo/ejemplos.js?compatibilidad');
    const almacen = crearMemoria({ usuarios: [{ usuario: 'admin', nombre: 'Admin sintético', rol: 'admin', pin: '1234' }],
      productos: [{ sku: 'demo-antes', demo: true }] }, { guardarEn: 'prueba-sin-escrituras' });
    await almacen.entrar('admin', '1234');
    const antes = localStorage.getItem('prueba-sin-escrituras');
    const retiro = [await almacen.cargarEjemplos(generarEjemplos()), await almacen.quitarEjemplos()];
    return { retiro, sinCambios: antes === localStorage.getItem('prueba-sin-escrituras'),
      ejemplo: await almacen.obtener('productos', 'demo-antes') };
  });
  assert.deepEqual(resultado.retiro, [{ ok: false, error: 'retirado' }, { ok: false, error: 'retirado' }]);
  assert.equal(resultado.sinCambios, true);
  assert.equal(resultado.ejemplo?.demo, true);
}));

test('La vista antigua en caché puede llamar al almacén compatible sin errores ni escrituras', tiempo, () => escenario(antigua, async env => {
  const p = await pagina(env);
  await operativo(p, 'v2.35');
  await p.waitForSelector('#modo-prueba');
  const mas = 'js/vistas/mas.js', memoria = 'js/datos/memoria.js';
  env.estado.raiz = puente;
  env.estado.fallos.set(mas, readFileSync(path.join(antigua, mas)));
  env.estado.fallos.set(infoPuente.prefijo + AJUSTES, 503);
  await actualizar(p);
  await rechazo(p, infoPuente.cache);

  await p.reload();
  await operativo(p, 'v2.35');
  await p.waitForFunction(async ({ ruta, bytes }) => {
    const cache = await caches.open('pos-v2.35');
    return await (await cache.match(ruta))?.text() === bytes;
  }, { ruta: memoria, bytes: readFileSync(path.join(puente, memoria), 'utf8') });
  await p.reload();
  await operativo(p, 'v2.35');
  const errores = [];
  p.on('pageerror', error => errores.push(error.message));
  const antes = await p.evaluate(() => localStorage.getItem('pos-demo-datos'));
  await p.click('#modo-prueba');
  await p.getByText('No se pudieron cargar. Revisa la conexión', { exact: true }).waitFor();
  assert.equal(await p.evaluate(() => localStorage.getItem('pos-demo-datos')), antes);
  assert.deepEqual(errores, []);
}));

test('La reversión local conserva los dos grafos y el borrador sin red', tiempo, () => escenario(futura, async env => {
  const p = await pagina(env);
  await operativo(p, infoFutura.version);
  const c = await borradorActivo(p);
  env.estado.raiz = posterior;
  assert.ok(readFileSync(path.join(posterior, infoFutura.prefijo + PRINCIPAL)).length > 0);
  await actualizar(p);
  await esperando(p);
  await env.contexto.setOffline(true);
  await p.close();

  const nueva = await pagina(env);
  await operativo(nueva, infoPuente.version);
  await nueva.waitForSelector('#retomar-si');
  assert.deepEqual((await leerBorrador(nueva)).c, c);
  const nombres = await nueva.evaluate(() => caches.keys());
  assert.ok(nombres.includes(infoPuente.cache) && nombres.includes(infoFutura.cache));
}));

function publicacion(raiz) {
  const sw = readFileSync(path.join(raiz, 'sw.js'), 'utf8');
  const info = JSON.parse(sw.match(/^const PUBLICACION = (\{.*\});$/m)[1]);
  const modulo = readFileSync(path.join(raiz, info.prefijo, 'js/version.js'), 'utf8');
  return { ...info, version: modulo.match(/APP_VERSION = '([^']+)'/)[1] };
}

async function prepararDatosLocales(p) {
  await p.evaluate(async ({ id, tienda }) => {
    const { almacen, ajustes } = window.__pos.ctx;
    const caja = await almacen.abrirCaja({ COP: 50_000, USD: 20 });
    if (!caja.ok) throw new Error(`No se pudo abrir la caja sintética: ${JSON.stringify(caja)}`);
    const venta = await almacen.guardarVenta({
      id, fecha: new Date().toISOString(), total: 42_000, subtotal: 42_000,
      lineas: [{ sku: 'J-M', cantidad: 1, nombre: 'Prenda piloto', subtotal: 42_000 }],
      pagos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 42_000 }],
    });
    if (!venta.ok) throw new Error(`No se pudo guardar la venta sintética: ${JSON.stringify(venta)}`);
    const guardado = await almacen.guardarAjustes('general', { tienda: { ...ajustes.tienda, nombre: tienda } });
    if (!guardado.ok) throw new Error('No se pudieron guardar los ajustes sintéticos');
  }, { id: VENTA, tienda: NOMBRE_TIENDA });
  await p.waitForFunction(({ id, tienda }) => {
    const datos = localStorage.getItem('pos-demo-datos');
    return datos?.includes(id) && datos.includes(tienda);
  }, { id: VENTA, tienda: NOMBRE_TIENDA });
}

async function datosLocales(p) {
  const datos = await p.evaluate(async ({ id, foto }) => {
    const { almacen } = window.__pos.ctx;
    const venta = almacen._estado('ventas').get(id);
    const caja = almacen._estado('cajas').get(venta?.cajaId);
    const tienda = almacen._estado('ajustes').get('general')?.tienda;
    const respuesta = await fetch(foto);
    if (!respuesta.ok) throw new Error(`Foto no disponible: ${respuesta.status}`);
    return { venta, caja, tienda, foto: Array.from(new Uint8Array(await respuesta.arrayBuffer())) };
  }, { id: VENTA, foto: FOTO });
  assert.equal(datos.venta?.id, VENTA);
  assert.equal(datos.venta.cajaId, datos.caja?.id);
  assert.equal(datos.tienda?.nombre, NOMBRE_TIENDA);
  assert.deepEqual(Buffer.from(datos.foto), readFileSync(path.join(path.resolve(artefactoCandidato), FOTO)));
  return datos;
}

async function guardarPendientes(p, c) {
  const pendientes = [{ que: 'abono', id: 'abono-piloto-sintetico', apartadoId: c.apartadoId }, { que: 'venta', id: c.ventaId }];
  await p.evaluate(({ clave, pendientes }) => localStorage.setItem(clave, JSON.stringify(pendientes)), { clave: PENDIENTES, pendientes });
  return pendientes;
}

async function comprobarDatosMigrados(p, inicial, carrito, pendientes) {
  assert.deepEqual(await datosLocales(p), inicial);
  await p.waitForSelector('#retomar-si');
  assert.deepEqual((await leerBorrador(p)).c, carrito);
  assert.deepEqual(await p.evaluate(clave => JSON.parse(localStorage.getItem(clave)), PENDIENTES), pendientes);
  await p.click('#retomar-si');
  assert.deepEqual(await p.evaluate(() => window.__pos.ctx.carrito), carrito);
}

if (artefactoAnterior && artefactoCandidato) {
  test('v2.35 migra al candidato exacto tras retomar el carrito, con venta, caja, ajustes, foto y pendientes offline', tiempo, async () => {
    const candidato = path.resolve(artefactoCandidato);
    await escenario(antigua, async env => {
      const p = await pagina(env);
      await operativo(p, 'v2.35');
      await prepararDatosLocales(p);
      const inicial = await datosLocales(p);
      const carrito = await borradorActivo(p);
      await p.reload();
      await p.waitForSelector('#retomar-si');
      env.estado.raiz = candidato;
      await actualizar(p);
      await esperando(p);
      await operativo(p, 'v2.35');
      await p.click('#retomar-si');
      assert.deepEqual(await p.evaluate(() => window.__pos.ctx.carrito), carrito);
      await env.contexto.setOffline(true);
      const pendientes = await guardarPendientes(p, carrito);
      await p.close();

      const nueva = await pagina(env);
      await operativo(nueva, publicacion(candidato).version);
      await comprobarDatosMigrados(nueva, inicial, carrito, pendientes);
    });
  });

  test('v2.41 actualiza al candidato exacto y revierte con los mismos datos, fotos y cachés', tiempo, async () => {
    const previo = path.resolve(artefactoAnterior);
    const candidato = path.resolve(artefactoCandidato);
    const versiones = [publicacion(previo), publicacion(candidato)];
    const reversion = path.join(temporal, 'reversion-artefacto');
    cpSync(candidato, reversion, { recursive: true });
    for (const archivo of ['index.html', 'sw.js']) {
      copyFileSync(path.join(previo, archivo), path.join(reversion, archivo));
    }
    assert.deepEqual(readFileSync(path.join(previo, 'config.js')), readFileSync(path.join(candidato, 'config.js')));
    assert.deepEqual(readFileSync(path.join(previo, FOTO)), readFileSync(path.join(candidato, FOTO)));

    await escenario(previo, async env => {
      const p = await pagina(env);
      await operativo(p, versiones[0].version);
      await prepararDatosLocales(p);
      const inicial = await datosLocales(p);
      const carrito = await borradorActivo(p);
      env.estado.raiz = candidato;
      await actualizar(p);
      await esperando(p);
      await operativo(p, versiones[0].version);
      await env.contexto.setOffline(true);
      const pendientes = await guardarPendientes(p, carrito);
      await p.close();

      const nueva = await pagina(env);
      await operativo(nueva, versiones[1].version);
      await comprobarDatosMigrados(nueva, inicial, carrito, pendientes);
      await env.contexto.setOffline(false);
      env.estado.raiz = reversion;
      await actualizar(nueva);
      await esperando(nueva);
      await env.contexto.setOffline(true);
      await nueva.close();

      const restaurada = await pagina(env);
      await operativo(restaurada, versiones[0].version);
      await comprobarDatosMigrados(restaurada, inicial, carrito, pendientes);
      const caches = await restaurada.evaluate(() => globalThis.caches.keys());
      for (const { cache } of versiones) assert.ok(caches.includes(cache));
    });
  });
}


for (const [nombre, opciones] of [['escritorio', {}], ['Android simulado', devices['Pixel 7']]]) {
  test('recupera la navegación con la caché del shell ausente · ' + nombre, tiempo, () => escenario(puente, async env => {
    const p = await pagina(env);
    await operativo(p, infoPuente.version);
    await p.evaluate(nombre => caches.delete(nombre), infoPuente.cache);
    const respuesta = await p.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(respuesta.status(), 200);
    await operativo(p, infoPuente.version);
    await env.contexto.setOffline(true);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await operativo(p, infoPuente.version);
  }, opciones));
}

test('repara un módulo ausente con una sola descarga compartida por ambas pestañas', tiempo, () => escenario(puente, async env => {
  const p = await pagina(env), otra = await pagina(env);
  await Promise.all([p, otra].map(pag => operativo(pag, infoPuente.version)));
  const url = infoPuente.prefijo + PRINCIPAL;
  await p.evaluate(async ({ nombre, url }) => (await caches.open(nombre)).delete(url), { nombre: infoPuente.cache, url });
  const inicio = env.estado.peticiones.length;
  const resultados = await Promise.all([p, otra].map(pag => pag.evaluate(async url => {
    const r = await fetch(url);
    return [r.status, r.headers.get('Content-Type')];
  }, url)));
  assert.deepEqual(resultados, [[200, 'text/javascript'], [200, 'text/javascript']]);
  assert.equal(env.estado.peticiones.slice(inicio).filter(r => r.ruta === url).length, 1);
  await env.contexto.setOffline(true);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await operativo(p, infoPuente.version);
}));

test('un 503 de módulo conserva el HTML válido y avisa al rechazar una mezcla con HTTP 200', tiempo, () => escenario(puente, async env => {
  const p = await pagina(env);
  await operativo(p, infoPuente.version);
  const url = infoPuente.prefijo + PRINCIPAL;
  await p.evaluate(async ({ nombre, url }) => (await caches.open(nombre)).delete(url), { nombre: infoPuente.cache, url });
  env.estado.fallos.set(infoPuente.prefijo + AJUSTES, Buffer.from('// bytes ajenos al artefacto'));
  const raiz = await p.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(raiz.status(), 200);
  await p.locator('#recuperar-pos').waitFor({ state: 'visible' });
  const subrecurso = await p.evaluate(async url => {
    const r = await fetch(url);
    return [r.status, r.headers.get('Content-Type'), await r.text()];
  }, url);
  assert.deepEqual(subrecurso, [503, 'text/plain; charset=utf-8', 'Recursos de la aplicación no disponibles.']);
  assert.equal(await p.evaluate(async ({ nombre, url }) => Boolean(await caches.match(url, { cacheName: nombre })), { nombre: infoPuente.cache, url }), false);
  env.estado.fallos.clear();
  await p.getByRole('button', { name: 'Reintentar' }).click();
  await operativo(p, infoPuente.version);
  assert.equal(await p.locator('#recuperar-pos').isVisible(), false);
}, devices['Pixel 7']));

test('sin caché y sin red muestra un 503 recuperable y conserva los datos', tiempo, () => escenario(puente, async env => {
  const p = await pagina(env);
  await operativo(p, infoPuente.version);
  await p.evaluate(nombre => {
    localStorage.setItem('pos-cobro-qa', 'recibo offline');
    return caches.delete(nombre);
  }, infoPuente.cache);
  await env.contexto.setOffline(true);
  assert.equal((await p.reload({ waitUntil: 'domcontentloaded' })).status(), 503);
  await p.getByRole('heading', { name: 'Recursos de la aplicación no disponibles.' }).waitFor();
  assert.equal(await p.evaluate(() => localStorage.getItem('pos-cobro-qa')), 'recibo offline');
  await env.contexto.setOffline(false);
  await p.getByRole('button', { name: 'Reintentar' }).click();
  await operativo(p, infoPuente.version);
}));

test('un fallo de cuota al reparar el shell deja disponibles la copia previa y las fotos', tiempo, async () => {
  const artefacto = path.join(temporal, 'con-cuota-simulada');
  cpSync(puente, artefacto, { recursive: true });
  appendFileSync(path.join(artefacto, 'sw.js'), `
let sinEspacio = false;
const putOriginal = Cache.prototype.put;
Cache.prototype.put = function(url, respuesta) {
  if (sinEspacio) return Promise.reject(new DOMException('Cuota de prueba', 'QuotaExceededError'));
  return putOriginal.call(this, url, respuesta);
};
self.addEventListener('message', e => {
  if (e.data?.pruebaCuota != null) { sinEspacio = e.data.pruebaCuota; e.ports[0].postMessage(true); }
});
`);
  await escenario(artefacto, async env => {
    const p = await pagina(env);
    await operativo(p, infoPuente.version);
    assert.equal(await p.evaluate(async foto => (await fetch(foto)).ok, FOTO), true);
    const url = infoPuente.prefijo + PRINCIPAL;
    const cuota = activar => p.evaluate(activar => new Promise(resolve => {
      const canal = new MessageChannel();
      canal.port1.onmessage = resolve;
      navigator.serviceWorker.controller.postMessage({ pruebaCuota: activar }, [canal.port2]);
    }).then(() => true), activar);
    assert.ok(await cuota(true));
    await p.evaluate(async ({ nombre, url }) => (await caches.open(nombre)).delete(url), { nombre: infoPuente.cache, url });
    assert.equal(await p.evaluate(async url => (await fetch(url)).status, url), 503);
    assert.deepEqual(await p.evaluate(async ({ nombre, base, foto }) => [
      Boolean(await caches.match(base, { cacheName: nombre })),
      Boolean(await caches.match(foto, { cacheName: 'fotos-v1' })),
    ], { nombre: infoPuente.cache, base: infoPuente.prefijo + 'index.html', foto: FOTO }), [true, true]);
    assert.ok(await cuota(false));
    assert.equal(await p.evaluate(async url => (await fetch(url)).status, url), 200);
  });
});

async function guardarResguardo(p) {
  await p.evaluate(async () => {
    localStorage.setItem('pos-pendientes-qa', 'venta-pendiente-qa');
    localStorage.setItem('pos-demo-datos:autorizacion:qa', 'autorizacion-qa');
    await new Promise((resolve, reject) => {
      const abrir = indexedDB.open('pos-qa-sincronizacion', 1);
      abrir.onerror = () => reject(abrir.error);
      abrir.onupgradeneeded = () => abrir.result.createObjectStore('cola');
      abrir.onsuccess = () => {
        const db = abrir.result, tx = db.transaction('cola', 'readwrite');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
        tx.objectStore('cola').put('cobro-local-qa', 'recibo');
      };
    });
  });
  assert.equal(await p.evaluate(async foto => (await fetch(foto)).ok, FOTO), true);
}

async function verificarResguardo(p) {
  assert.deepEqual(await p.evaluate(async foto => {
    const recibo = await new Promise((resolve, reject) => {
      const abrir = indexedDB.open('pos-qa-sincronizacion', 1);
      abrir.onerror = () => reject(abrir.error);
      abrir.onsuccess = () => {
        const db = abrir.result, leer = db.transaction('cola').objectStore('cola').get('recibo');
        leer.onsuccess = () => { db.close(); resolve(leer.result); };
        leer.onerror = () => { db.close(); reject(leer.error); };
      };
    });
    return [localStorage.getItem('pos-pendientes-qa'), localStorage.getItem('pos-demo-datos:autorizacion:qa'),
      recibo, Boolean(await caches.match(foto, { cacheName: 'fotos-v1' }))];
  }, FOTO), ['venta-pendiente-qa', 'autorizacion-qa', 'cobro-local-qa', true]);
}

test('reinicia Chromium con un perfil persistente, repara el shell y conserva el resguardo', tiempo, () => escenario(puente, async env => {
  const perfil = path.join(temporal, 'perfil-reinicio');
  const abrir = () => chromium.launchPersistentContext(perfil, iniciarChromium);
  let contexto = await abrir();
  try {
    let p = await pagina({ ...env, contexto });
    await operativo(p, infoPuente.version);
    await guardarResguardo(p);
    await borradorActivo(p);
    await p.evaluate(nombre => caches.delete(nombre), infoPuente.cache);
    await contexto.close();

    contexto = await abrir();
    p = await pagina({ ...env, contexto });
    await operativo(p, infoPuente.version);
    await verificarResguardo(p);
    assert.equal((await leerBorrador(p)).c.ventaId, 'venta-de-prueba');
  } finally { await contexto.close(); }
}));

if (artefactoAnterior && artefactoCandidato) {
  test('v2.42 con 503 y dos clientes deja al candidato en espera hasta cerrar; un perfil limpio sí abre', tiempo, () => {
    const previo = path.resolve(artefactoAnterior), candidato = path.resolve(artefactoCandidato);
    const anterior = publicacion(previo), siguiente = publicacion(candidato);
    return escenario(previo, async env => {
      const p = await pagina(env), otra = await pagina(env);
      await Promise.all([p, otra].map(pag => operativo(pag, anterior.version)));
      await guardarResguardo(p);
      await borradorActivo(p);
      env.estado.raiz = candidato;
      await actualizar(p);
      await esperando(p);
      await p.evaluate(async nombre => (await caches.open(nombre)).delete(
        (await (await caches.open(nombre)).keys()).find(r => r.url.endsWith('/index.html'))), anterior.cache);
      assert.equal((await p.reload({ waitUntil: 'domcontentloaded' })).status(), 503);
      await esperando(otra);
      const limpia = await browser.newContext({ ignoreHTTPSErrors: true });
      try { await operativo(await pagina({ ...env, contexto: limpia }), siguiente.version); }
      finally { await limpia.close(); }
      await p.close();
      await esperando(otra);
      await otra.close();
      const nueva = await pagina(env);
      await operativo(nueva, siguiente.version);
      await verificarResguardo(nueva);
      assert.equal((await leerBorrador(nueva)).c.ventaId, 'venta-de-prueba');
    }, devices['Pixel 7']);
  });
}
