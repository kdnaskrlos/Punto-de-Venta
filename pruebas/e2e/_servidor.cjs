// Utilidades para las pruebas en navegador: servidor estático local + navegador Playwright.
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

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
    async pagina({ ancho = 1530, alto = 900, ruta = '', query = '?demo' } = {}) {
      const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, serviceWorkers: 'block' });
      const p = await ctx.newPage();
      p.errores = [];
      p.on('pageerror', e => p.errores.push(String(e)));
      p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/.test(m.text())) p.errores.push(m.text()); });
      await p.goto(URL_BASE + query + (ruta ? '#' + ruta : ''));
      await p.waitForSelector('#app[data-listo="1"]', { timeout: 8000 });
      return p;
    },
    async cerrar() { await nav.close(); srv.kill(); },
  };
}

// Mini corredor de pruebas: imprime cada caso y sale con código 1 si alguno falla.
async function casos(nombre, lista) {
  const assert = require('assert');
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

module.exports = { arrancar, casos, URL_BASE };
