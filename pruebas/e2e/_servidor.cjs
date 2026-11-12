// Utilidades para las pruebas en navegador: servidor estático local + navegador Playwright.
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { chromium, devices } = require('playwright');

const RAIZ = path.resolve(__dirname, '..', '..');
const PUERTO = 8765;
const URL_BASE = `http://localhost:${PUERTO}/`;

function esperarServidor(intentos = 50) {
  return new Promise((ok, mal) => {
    const probar = n => http.get(URL_BASE, r => { r.resume(); ok(); }).on('error', () => n ? setTimeout(() => probar(n - 1), 100) : mal(new Error('servidor no arrancó')));
    probar(intentos);
  });
}

async function arrancar() {
  const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
  await esperarServidor();
  const nav = await chromium.launch();
  return {
    nav,
    // usuario: con quién entrar (null = quedarse en la pantalla de entrada). caja: abrir caja antes de la prueba.
    // movil: teléfono real simulado (zoom, toque y ventana de diseño como Chrome en Android).
    async pagina({ ancho = 1530, alto = 900, ruta = '', query = '?demo', usuario = 'admin', caja = false, movil = false } = {}) {
      const ctx = await nav.newContext(movil ? { ...devices['Pixel 7'], serviceWorkers: 'block' } : { viewport: { width: ancho, height: alto }, serviceWorkers: 'block' });
      const p = await ctx.newPage();
      p.setDefaultTimeout(6000);
      p.errores = [];
      p.on('pageerror', e => p.errores.push(String(e)));
      p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/.test(m.text())) p.errores.push(m.text()); });
      await p.route(/kdnaskrlos\.github\.io/, r => r.abort());
      await p.goto(URL_BASE + query + (ruta ? '#' + ruta : ''));
      await p.waitForSelector('#app[data-listo="1"]', { timeout: 8000 });
      if (usuario) {
        // Demostración directa: ya entró como el último rol usado; se cambia sin PIN.
        if (await p.$('#entrar-usuario')) await entrarComo(p, usuario);
        else { await p.evaluate(u => window.__pos.ctx.almacen.entrar(u, '1234'), usuario); await p.waitForFunction(u => window.__pos.ctx.sesion?.usuario === u, usuario); await p.waitForSelector('.side .nav'); }
      }
      if (caja) await p.evaluate(() => window.__pos.ctx.almacen.abrirCaja({ COP: 50000, USD: 20, BS: 500 }));
      if (usuario && ruta) { await p.evaluate(r => { location.hash = r; }, ruta); await p.waitForSelector(`.vista[data-ruta="${ruta}"]`); }
      return p;
    },
    async cerrar() { await nav.close(); srv.kill(); },
  };
}

async function entrarComo(p, usuario, pin = '1234') {
  await p.fill('#entrar-usuario', usuario);
  await p.fill('#entrar-pin', pin);
  await p.click('#entrar-btn');
  await p.waitForSelector('.side .nav', { timeout: 5000 });
}

// Mini corredor de pruebas: imprime cada caso y sale con código 1 si alguno falla.
async function casos(nombre, lista) {
  // Las comparaciones que fallan con un elemento de la página como valor se colgaban al describirlo:
  // se reemplaza por un texto corto antes de comparar.
  const base = require('assert');
  const limpio = x => (x && typeof x === 'object' && /Handle$/.test(x.constructor?.name || '')) ? '<elemento de la página>' : x;
  const assert = new Proxy(base, { get: (t, k) => typeof t[k] === 'function' ? (...args) => t[k](...args.map(limpio)) : t[k] });
  let fallos = 0;
  const env = await arrancar();
  for (const [titulo, fn] of lista) {
    try { await fn(env, assert); console.log(`  ok  ${titulo}`); }
    catch (e) { fallos++; console.log(`  FALLA ${titulo}\n        ${String(e.message || e).split('\n').slice(0, 6).join('\n        ')}`); }
  }
  await env.cerrar();
  console.log(`${nombre}: ${lista.length - fallos}/${lista.length} pasan`);
  process.exit(fallos ? 1 : 0);
}

// Demostración: cambia de rol desde Mi cuenta → "Probar como", sin PIN (como lo haría Carlos).
async function cambiarA(p, usuario) {
  await p.click('.side [aria-label="Mi cuenta"]');
  await p.click('#probar-' + usuario);
  await p.waitForFunction(u => window.__pos.ctx.sesion?.usuario === u, usuario);
  await p.waitForSelector('.side .nav');
}

module.exports = { arrancar, casos, entrarComo, cambiarA, URL_BASE };
