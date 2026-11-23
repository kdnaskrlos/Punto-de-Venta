// Actualización real del service worker en Chromium contra dos árboles locales.
// Requiere Playwright, Chromium, OpenSSL y el commit de la v2.35 en el clon.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readdirSync, readFileSync, rmSync, createReadStream, statSync } = require('node:fs');
const https = require('node:https');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '../..');
const PREFIJO = '/Punto-de-Venta';
const VIEJA = 'pos-v2.35';
const NUEVA = 'pos-v2.36';
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

async function servir(temporal) {
  const cert = path.join(temporal, 'cert.pem'), key = path.join(temporal, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' });
  const estado = { raiz: RAIZ, faltar: '', obsoleto: '', rechazados: 0, obsoletos: 0 };
  const servidor = https.createServer({ cert: readFileSync(cert), key: readFileSync(key) }, (req, res) => {
    const { pathname } = new URL(req.url, 'https://localhost');
    if (!pathname.startsWith(PREFIJO + '/')) { res.writeHead(404).end(); return; }
    const recurso = pathname === PREFIJO + '/' ? '/index.html' : pathname.slice(PREFIJO.length);
    res.setHeader('Cache-Control', 'no-store');
    if (recurso === estado.faltar) {
      estado.rechazados++;
      res.writeHead(503).end();
      return;
    }
    const raiz = recurso === estado.obsoleto ? temporal : estado.raiz;
    if (recurso === estado.obsoleto) estado.obsoletos++;
    const archivo = path.resolve(raiz, '.' + recurso);
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

async function comprobarInstalacionRechazada(pagina) {
  await buscarActualizacion(pagina).catch(error => {
    // El navegador puede rechazar update() cuando falla la instalación.
    if (!String(error).includes('Failed to update a ServiceWorker')) throw error;
  });
  await pagina.waitForFunction(async nombre => {
    const reg = await navigator.serviceWorker.ready;
    return !reg.installing && !reg.waiting && !(await caches.has(nombre));
  }, NUEVA);
}

async function probarInstalacionLimpia(browser, ruta) {
  const contexto = await contextoLocal(browser);
  try {
    const pagina = await abrir(contexto, ruta);
    await version(pagina, 'v2.36');
    const recursos = ['js', 'css'].flatMap(dir => readdirSync(path.join(RAIZ, dir), { recursive: true })
      .filter(archivo => /\.(?:js|css)$/.test(archivo)).map(archivo => path.posix.join(PREFIJO, dir, archivo)));
    const guardados = await pagina.evaluate(async nombre =>
      (await (await caches.open(nombre)).keys()).map(peticion => new URL(peticion.url).pathname), NUEVA);
    assert.deepEqual(recursos.filter(url => !guardados.includes(url)), [], 'la caché contiene todo el grafo local');
    assert.ok(await pagina.getByRole('button', { name: 'Modo demo', exact: true }).isVisible());
    assert.equal(await pagina.locator('#modo-prueba').count(), 0);
    assert.equal(await pagina.evaluate(() => performance.getEntriesByType('navigation')[0].type), 'navigate',
      'el primer control del worker no provoca una recarga');
    await contexto.setOffline(true);
    await pagina.reload();
    await version(pagina, 'v2.36');
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

async function probarMigracion(browser, ruta, estado, temporal) {
  estado.raiz = temporal;
  const contexto = await contextoLocal(browser);
  try {
    const pagina = await abrir(contexto, ruta);
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

    estado.raiz = RAIZ;
    estado.faltar = '/js/vistas/ajustes.js';
    await comprobarInstalacionRechazada(pagina);
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
    estado.obsoleto = '/js/vistas/mas.js';
    await comprobarInstalacionRechazada(pagina);
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
    await pagina.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await pagina.waitForSelector('.toast.version .ver-btn:enabled');
    let recargas = 0;
    const contarRecarga = peticion => { if (peticion.isNavigationRequest() && peticion.frame() === pagina.mainFrame()) recargas++; };
    pagina.on('request', contarRecarga);
    await pagina.click('.toast.version .ver-btn');
    await version(pagina, 'v2.36');
    await pagina.waitForSelector('#retomar-si');
    pagina.off('request', contarRecarga);
    assert.equal(recargas, 1, 'el cambio de controlador provoca una sola recarga');
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
    estado.faltar = '/js/vistas/ajustes.js';
    await contexto.setOffline(false);
    const rechazados = estado.rechazados;
    await pagina.reload();
    await version(pagina, 'v2.36');
    const js = await pagina.evaluate(async () => (await fetch('js/vistas/ajustes.js?prueba-cache=1')).text());
    assert.match(js, /pastillaModoDemo/);
    assert.equal(estado.rechazados, rechazados);
    assert.deepEqual(pagina.errores, []);
    console.log('ok la versión activa sirve el módulo precargado aunque la red devuelva 503');
  } finally {
    await contexto.close();
  }
}

async function ejecutar() {
  const temporal = mkdtempSync(path.join(tmpdir(), 'pos-pwa-'));
  let servidor, browser;
  try {
    prepararVersionAnterior(temporal);
    const local = await servir(temporal);
    servidor = local.servidor;
    browser = await chromium.launch({
      executablePath: process.env.POS_CHROMIUM_PATH,
      args: ['--ignore-certificate-errors', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost'],
    });
    await probarInstalacionLimpia(browser, local.ruta);
    await probarMigracion(browser, local.ruta, local.estado, temporal);
  } finally {
    await browser?.close();
    servidor?.close();
    rmSync(temporal, { recursive: true, force: true });
  }
}

ejecutar().catch(error => { console.error(error); process.exitCode = 1; });
