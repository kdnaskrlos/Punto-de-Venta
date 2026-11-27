// Actualización real del service worker en Chromium contra dos árboles locales.
// Requiere Playwright, Chromium, OpenSSL y el commit de la v2.35 en el clon.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, createReadStream, statSync } = require('node:fs');
const https = require('node:https');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { preparar } = require('../../scripts/preparar-publicacion.cjs');

const RAIZ = path.resolve(__dirname, '../..');
const PREFIJO = '/Punto-de-Venta';
const VIEJA = 'pos-v2.35';
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

function prepararVersionAnterior(temporal) {
  const archivo = execFileSync('git', ['archive', '1423e187fba3cfe0bda293baaaa26c3350ef7cf2'], {
    cwd: RAIZ, maxBuffer: 16 * 1024 * 1024,
  });
  execFileSync('tar', ['-x', '-C', temporal], { input: archivo });
}

async function servir(temporal, anterior, artefacto, prefijo) {
  const cert = path.join(temporal, 'cert.pem'), key = path.join(temporal, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' });
  const estado = { raiz: artefacto, faltar: '', obsoleto: '', rechazados: 0, obsoletos: 0 };
  const servidor = https.createServer({ cert: readFileSync(cert), key: readFileSync(key) }, (req, res) => {
    const { pathname } = new URL(req.url, 'https://localhost');
    if (pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html>'); return; }
    if (!pathname.startsWith(PREFIJO + '/')) { res.writeHead(404).end(); return; }
    const recurso = pathname === PREFIJO + '/' ? '/index.html' : pathname.slice(PREFIJO.length);
    res.setHeader('Cache-Control', 'no-store');
    if (recurso === estado.faltar) {
      estado.rechazados++;
      res.writeHead(503).end();
      return;
    }
    const obsoleto = recurso === estado.obsoleto;
    const raiz = obsoleto ? anterior : estado.raiz;
    if (obsoleto) estado.obsoletos++;
    const rutaArchivo = recurso.slice(obsoleto ? 1 + prefijo.length : 1);
    const archivo = path.resolve(raiz, rutaArchivo);
    const existe = archivo.startsWith(raiz + path.sep) && statSync(archivo, { throwIfNoEntry: false })?.isFile();
    if (!existe) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', TIPOS[path.extname(archivo)] || 'application/octet-stream');
    createReadStream(archivo).on('error', () => res.destroy()).pipe(res);
  });
  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolve);
  });
  return { servidor, estado, ruta: `https://localhost:${servidor.address().port}${PREFIJO}/?demo#/ajustes` };
}

async function contextoLocal(browser) {
  return browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1530, height: 900 } });
}

async function abrir(contexto, ruta) {
  const pagina = await contexto.newPage();
  pagina.errores = [];
  pagina.on('pageerror', error => pagina.errores.push(error.message));
  await pagina.goto(ruta);
  await pagina.waitForSelector('#app[data-listo="1"]');
  await pagina.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  return pagina;
}

async function version(pagina, esperada) {
  await pagina.waitForFunction(v => document.querySelector('.ver')?.textContent === v, esperada);
}

async function buscarActualizacion(pagina) {
  await pagina.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    await reg.update();
    const instalando = reg.installing;
    if (!instalando) return;
    await new Promise(resolve => {
      function comprobar() {
        if (['installed', 'activating', 'activated', 'redundant'].includes(instalando.state)) {
          instalando.removeEventListener('statechange', comprobar);
          resolve();
        }
      }
      instalando.addEventListener('statechange', comprobar);
      comprobar();
    });
  });
}

async function comprobarInstalacionRechazada(pagina, cache) {
  await buscarActualizacion(pagina).catch(error => {
    // El navegador puede rechazar update() cuando falla la instalación.
    if (!String(error).includes('Failed to update a ServiceWorker')) throw error;
  });
  await pagina.waitForFunction(async nombre => {
    const reg = await navigator.serviceWorker.ready;
    return !reg.installing && !reg.waiting && !(await caches.has(nombre));
  }, cache);
}

async function probarInstalacionLimpia(browser, ruta, { prefijo, cache, version: esperada }) {
  const contexto = await contextoLocal(browser);
  try {
    const pagina = await abrir(contexto, ruta);
    await version(pagina, esperada);
    const recursos = ['js', 'css'].flatMap(dir => readdirSync(path.join(RAIZ, dir), { recursive: true })
      .filter(archivo => /\.(?:js|css)$/.test(archivo)).map(archivo => path.posix.join(PREFIJO, prefijo, dir, archivo)));
    const guardados = await pagina.evaluate(async nombre =>
      (await (await caches.open(nombre)).keys()).map(peticion => new URL(peticion.url).pathname), cache);
    assert.deepEqual(recursos.filter(url => !guardados.includes(url)), [], 'la caché contiene todo el grafo local');
    assert.ok(await pagina.getByRole('button', { name: 'Modo demo', exact: true }).isVisible());
    assert.equal(await pagina.locator('#modo-prueba').count(), 0);
    assert.equal(await pagina.evaluate(() => performance.getEntriesByType('navigation')[0].type), 'navigate',
      'el primer control del worker no provoca una recarga');
    await contexto.setOffline(true);
    await pagina.reload();
    await version(pagina, esperada);
    await pagina.evaluate(() => { location.hash = '/inventario'; });
    await pagina.waitForSelector('.vista[data-ruta="/inventario"] .tarjeta-prenda');
    await pagina.evaluate(() => {
      const c = { lineas: [{ sku: 'J-M', cantidad: 1 }], ventaId: 'sin-retomar' };
      localStorage.setItem('pos-venta-admin', JSON.stringify({ c, en: Date.now() }));
    });
    await pagina.reload();
    await pagina.waitForSelector('#retomar-si');
    await pagina.reload();
    await pagina.waitForSelector('#retomar-si');
    assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem('pos-venta-admin')).c.ventaId), 'sin-retomar');
    assert.deepEqual(pagina.errores, []);
    console.log('ok instalación limpia, sin recarga inicial, inventario offline y borrador aún sin retomar');
  } finally {
    await contexto.close();
  }
}

async function probarMigracion(browser, ruta, estado, anterior, artefacto, { prefijo, cache, version: esperada }) {
  estado.raiz = anterior;
  const contexto = await contextoLocal(browser);
  try {
    let pagina = await abrir(contexto, ruta);
    await pagina.waitForSelector('#modo-prueba');
    await version(pagina, 'v2.35');
    await pagina.waitForFunction(async nombre => {
      const cache = await caches.open(nombre);
      return Boolean(await cache.match('js/vistas/mas.js') && await cache.match('js/vistas/ajustes.js'));
    }, VIEJA);
    await pagina.evaluate(async nombre => {
      const cache = await caches.open(nombre);
      await cache.put('tasa-sintetica.json?t=1', new Response('{"rate":42}'));
      await caches.open('otra-app-del-origen');
    }, VIEJA);

    estado.raiz = artefacto;
    estado.faltar = '/' + prefijo + 'js/vistas/ajustes.js';
    await comprobarInstalacionRechazada(pagina, cache);
    assert.ok(estado.rechazados > 0, 'se reprodujo el 503 durante la instalación');

    // El worker de v2.35 aún rellena sus módulos por separado.
    await pagina.reload();
    await pagina.waitForSelector('#app[data-listo="1"]');
    await pagina.waitForFunction(async nombre => {
      const cache = await caches.open(nombre);
      const mas = await cache.match('js/vistas/mas.js'), ajustes = await cache.match('js/vistas/ajustes.js');
      return (await mas.text()).includes('acceso-demo') && (await ajustes.text()).includes('bloquePrueba');
    }, VIEJA);
    await contexto.setOffline(true);
    await pagina.reload();
    await pagina.waitForSelector('#app[data-listo="1"]');
    await pagina.waitForSelector('#modo-demo');
    assert.equal(await pagina.locator('.toast.version').count(), 0, 'no avisa sin candidato instalado');
    assert.deepEqual(pagina.errores, [], 'Ajustes de v2.35 puede arrancar con Más renovado');
    console.log('ok 503, caché anterior utilizable sin conexión y módulos mezclados de v2.35 sin error');

    // Se conserva una segunda pestaña con su propia sesión y datos en pantalla.
    await contexto.setOffline(false);
    const otra = await abrir(contexto, ruta);
    await otra.evaluate(async () => window.__pos.ctx.almacen.entrar('vendedora', '1234'));
    await otra.waitForFunction(() => window.__pos.ctx.sesion?.usuario === 'vendedora');
    estado.faltar = '';
    estado.obsoleto = '/' + prefijo + 'js/vistas/mas.js';
    await comprobarInstalacionRechazada(pagina, cache);
    assert.ok(estado.obsoletos > 0, 'se sirvió un módulo obsoleto con HTTP 200');
    estado.obsoleto = '';
    console.log('ok el candidato también se rechaza si el servidor devuelve JavaScript antiguo con HTTP 200');

    const borrador = await pagina.evaluate(async () => {
      const { ctx } = window.__pos;
      await ctx.almacen.guardarCliente({ nombre: 'Cliente sintético PWA', telefono: '0000000000' });
      ctx.carrito = {
        lineas: [{ sku: 'J-M', cantidad: 1 }], cliente: { nombre: 'Cliente sintético PWA' },
        ventaId: 'venta-sintetica-pwa', pagos: [{ forma: 'efectivo', monto: 5000 }],
      };
      dispatchEvent(new CustomEvent('pos:carrito'));
      localStorage.setItem('pos-pendientes-otra-cuenta', '[{"que":"venta","id":"pendiente-pwa"}]');
      return ctx.carrito;
    });
    await pagina.waitForFunction(() => localStorage.getItem('pos-demo-datos')?.includes('Cliente sintético PWA'));

    await buscarActualizacion(pagina);
    await pagina.waitForSelector('.toast.version .ver-btn');
    await pagina.click('.toast.version .ver-btn');
    const sigueEsperando = await pagina.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting));
    assert.ok(sigueEsperando, 'el worker espera mientras otra pestaña del POS sigue abierta');
    assert.equal(await otra.evaluate(() => window.__pos.ctx.sesion.usuario), 'vendedora');
    await otra.close();
    await contexto.setOffline(true);
    await pagina.evaluate(() => localStorage.setItem('pos-pendientes-admin', '[{"que":"venta","id":"pendiente-admin"}]'));
    assert.ok(await pagina.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting)));
    assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem('pos-venta-admin')).c.ventaId),
      borrador.ventaId, 'el carrito activo está resguardado antes de cerrar');
    await pagina.close();
    pagina = await abrir(contexto, ruta);
    await version(pagina, esperada);
    await pagina.waitForSelector('#retomar-si');
    const datos = await pagina.evaluate(async () => ({
      tasa: await (await fetch('tasa-sintetica.json?t=2')).json(),
      otraCache: await caches.has('otra-app-del-origen'),
    }));
    assert.deepEqual(datos, { tasa: { rate: 42 }, otraCache: true });
    assert.equal(await pagina.evaluate(() => localStorage.getItem('pos-pendientes-otra-cuenta')),
      '[{"que":"venta","id":"pendiente-pwa"}]');
    assert.equal(await pagina.evaluate(() => localStorage.getItem('pos-pendientes-admin')),
      '[{"que":"venta","id":"pendiente-admin"}]');
    assert.ok(await pagina.evaluate(() => localStorage.getItem('pos-demo-datos').includes('Cliente sintético PWA')));
    await pagina.click('#retomar-si');
    await pagina.waitForFunction(() => window.__pos.ctx.carrito?.ventaId === 'venta-sintetica-pwa');
    assert.deepEqual(await pagina.evaluate(() => window.__pos.ctx.carrito.lineas), borrador.lineas);
    assert.deepEqual(await pagina.evaluate(() => window.__pos.ctx.carrito.pagos), borrador.pagos);
    await pagina.evaluate(() => { location.hash = '/ajustes'; });
    await pagina.waitForSelector('#modo-demo');
    assert.equal(await pagina.locator('#modo-prueba').count(), 0);
    assert.deepEqual(pagina.errores, []);
    console.log('ok recuperación, aviso, actualización con pestañas abiertas y conservación de carrito, borrador y pendientes');

    // Tras activar, una respuesta distinta en la red no sustituye un módulo precargado.
    estado.faltar = '/' + prefijo + 'js/vistas/ajustes.js';
    await contexto.setOffline(false);
    const rechazados = estado.rechazados;
    await pagina.reload();
    await version(pagina, esperada);
    const js = await pagina.evaluate(async ruta => (await fetch(ruta)).text(), prefijo + 'js/vistas/ajustes.js?prueba-cache=1');
    assert.match(js, /pastillaModoDemo/);
    assert.equal(estado.rechazados, rechazados);
    assert.deepEqual(pagina.errores, []);
    console.log('ok la versión activa sirve el módulo precargado aunque la red devuelva 503');
  } finally {
    await contexto.close();
  }
}

async function probarReparacion(browser, ruta, estado, artefacto, { prefijo, cache, version: esperada }) {
  estado.raiz = artefacto;
  estado.faltar = '';
  const contexto = await contextoLocal(browser);
  try {
    const pagina = await abrir(contexto, ruta);
    await pagina.evaluate(async ({ cache, prefijo }) => {
      localStorage.setItem('pos-venta-admin', JSON.stringify({
        c: { lineas: [{ sku: 'J-M', cantidad: 1 }], ventaId: 'carrito-reparacion' }, en: Date.now(),
      }));
      localStorage.setItem('pos-pendientes-admin', '[{"id":"pendiente-reparacion"}]');
      await new Promise((resolve, reject) => {
        const abrir = indexedDB.open('prueba-pos-reparacion', 1);
        abrir.onupgradeneeded = () => abrir.result.createObjectStore('cobros').put('original', 'pendiente');
        abrir.onsuccess = () => { abrir.result.close(); resolve(); };
        abrir.onerror = () => reject(abrir.error);
      });
      const shell = await caches.open(cache);
      await shell.put(prefijo + 'index.html', new Response('<h1>HTML dañado</h1>', { headers: { 'Content-Type': 'text/html' } }));
      await shell.delete(prefijo + 'js/principal.js');
    }, { cache, prefijo });

    await contexto.setOffline(true);
    assert.equal((await pagina.reload()).status(), 503);
    await pagina.waitForSelector('#recuperar-pos');
    await contexto.setOffline(false);
    estado.obsoleto = '/' + prefijo + 'js/vistas/mas.js';
    const obsoletos = estado.obsoletos;
    assert.equal((await pagina.reload()).status(), 503);
    assert.ok(estado.obsoletos > obsoletos, 'se rechazó un módulo de otra revisión servido con HTTP 200');
    estado.obsoleto = '';
    await pagina.getByRole('button', { name: 'Reintentar' }).click();
    await version(pagina, esperada);
    await pagina.waitForSelector('#retomar-si');

    const datos = await pagina.evaluate(async () => ({
      carrito: JSON.parse(localStorage.getItem('pos-venta-admin')).c.ventaId,
      pendientes: localStorage.getItem('pos-pendientes-admin'),
      sesion: window.__pos.ctx.sesion.usuario,
      idb: await new Promise((resolve, reject) => {
        const abrir = indexedDB.open('prueba-pos-reparacion', 1);
        abrir.onerror = () => reject(abrir.error);
        abrir.onsuccess = () => {
          const db = abrir.result, leer = db.transaction('cobros').objectStore('cobros').get('pendiente');
          leer.onsuccess = () => { db.close(); resolve(leer.result); };
          leer.onerror = () => { db.close(); reject(leer.error); };
        };
      }),
    }));
    assert.deepEqual(datos, {
      carrito: 'carrito-reparacion', pendientes: '[{"id":"pendiente-reparacion"}]', sesion: 'admin', idb: 'original',
    });
    await pagina.evaluate(async ({ cache, prefijo }) => {
      const shell = await caches.open(cache);
      await shell.put(prefijo + 'js/vistas/mas.js', new Response('throw new Error("dañado")', {
        headers: { 'Content-Type': 'text/javascript' },
      }));
    }, { cache, prefijo });
    const recuperado = await pagina.evaluate(async url => (await fetch(url)).text(), prefijo + 'js/vistas/mas.js');
    assert.ok(recuperado.includes('acceso-demo'), 'el módulo dañado también se repara durante una sesión abierta');

    await contexto.setOffline(true);
    await pagina.reload();
    await version(pagina, esperada);
    console.log('ok repara HTML corrupto, módulo ausente y módulo dañado sin perder datos, y vuelve a arrancar offline');
  } finally {
    estado.obsoleto = '';
    await contexto.close();
  }
}

async function probarV242Incompleta(browser, ruta, estado, v242, artefacto, { cache, version: esperada }) {
  estado.raiz = v242;
  const contexto = await contextoLocal(browser);
  try {
    let pagina = await abrir(contexto, ruta);
    await version(pagina, 'v2.42');
    await pagina.evaluate(async () => {
      localStorage.setItem('pos-pendientes-prueba', '[{"id":"legado-pendiente"}]');
      await caches.delete('pos-v2.42-57bc1ad5b01c5d41');
    });
    assert.equal((await pagina.reload()).status(), 503);
    assert.match(await pagina.locator('body').innerText(), /Recursos de la aplicación no disponibles/);
    estado.raiz = artefacto;
    assert.equal((await pagina.reload()).status(), 503, 'la navegación aún pertenece a v2.42');
    await buscarActualizacion(pagina);
    await pagina.waitForFunction(async nombre => Boolean((await navigator.serviceWorker.getRegistration()).waiting)
      && await caches.has(nombre), cache);
    const fueraDelAlcance = await contexto.newPage();
    await fueraDelAlcance.goto(new URL('/', ruta).href);
    await pagina.close();
    await fueraDelAlcance.waitForFunction(async url => {
      const registro = await navigator.serviceWorker.getRegistration(url);
      return !registro.waiting && registro.active?.state === 'activated';
    }, ruta);
    await contexto.setOffline(true);
    pagina = await abrir(contexto, ruta);
    await version(pagina, esperada);
    assert.equal(await pagina.evaluate(() => localStorage.getItem('pos-pendientes-prueba')), '[{"id":"legado-pendiente"}]');
    assert.equal(await pagina.evaluate(() => performance.getEntriesByType('navigation')[0].type), 'navigate');
    console.log('ok desde un 503 de v2.42 se instala el candidato y se activa al cerrar el último cliente');
  } finally {
    await contexto.close();
  }
}

async function ejecutar() {
  const temporal = mkdtempSync(path.join(tmpdir(), 'pos-pwa-'));
  let servidor, browser;
  try {
    const anterior = path.join(temporal, 'anterior');
    mkdirSync(anterior);
    prepararVersionAnterior(anterior);
    const artefacto = path.join(temporal, 'publicacion');
    const publicacion = preparar(artefacto);
    const local = await servir(temporal, anterior, artefacto, publicacion.prefijo);
    servidor = local.servidor;
    browser = await chromium.launch({
      executablePath: process.env.POS_CHROMIUM_PATH,
      args: ['--ignore-certificate-errors', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost'],
    });
    await probarInstalacionLimpia(browser, local.ruta, publicacion);
    await probarMigracion(browser, local.ruta, local.estado, anterior, artefacto, publicacion);
    await probarReparacion(browser, local.ruta, local.estado, artefacto, publicacion);
    const v242 = path.join(temporal, 'v242');
    mkdirSync(v242);
    execFileSync('tar', ['-x', '-C', v242], {
      input: execFileSync('git', ['archive', '0c3c7983fb288acc475ff4b44bcf071ea40df0f2'], {
        cwd: RAIZ, maxBuffer: 16 * 1024 * 1024,
      }),
    });
    await probarV242Incompleta(browser, local.ruta, local.estado, v242, artefacto, publicacion);
  } finally {
    await browser?.close();
    servidor?.close();
    rmSync(temporal, { recursive: true, force: true });
  }
}

ejecutar().catch(error => { console.error(error); process.exitCode = 1; });
