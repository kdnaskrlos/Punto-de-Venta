// Tarea 1: esqueleto instalable con navegación, cabecera, versión, ventanas y botón atrás.
const { casos } = require('./_servidor.cjs');
const VERSION = require('fs').readFileSync(require('path').join(__dirname, '../../js/version.js'), 'utf8').match(/'(v[\d.]+)'/)[1];

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const hoy = new Date();
const FECHA = `${DIAS[hoy.getDay()]} ${hoy.getDate()} ${MESES[hoy.getMonth()]}`;

async function medidas(p, sel) {
  return p.$$eval(sel, els => els.filter(e => e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, t: e.getAttribute('aria-label') || e.textContent.trim() }; }));
}

casos('esqueleto', [
  ['PC: barra lateral con 8 accesos ≥ 44 px', async (env, a) => {
    const p = await env.pagina();
    const n = await medidas(p, '.side .nav');
    a.strictEqual(n.length, 8, JSON.stringify(n.map(x => x.t)));
    for (const x of n) a.ok(x.w >= 44 && x.h >= 44, `${x.t} mide ${x.w}x${x.h}`);
  }],
  ['PC: cabecera con conexión, tasas, calculadora y fecha; sin botón de actualizar', async (env, a) => {
    const p = await env.pagina();
    for (const s of ['.topbar .conn', '.topbar .tasas', '.topbar [aria-label="Calculadora"]', '.topbar .fecha']) a.ok(await p.$(s), `falta ${s}`);
    a.strictEqual(await p.$('.topbar [aria-label="Actualizar"]'), null);
    a.strictEqual((await p.textContent('.topbar .fecha')).trim(), FECHA);
    for (const x of await medidas(p, '.topbar button')) a.ok(x.w >= 44 && x.h >= 44, `${x.t} mide ${x.w}x${x.h}`);
  }],
  ['Versión visible (en Más, no en Inicio)', async (env, a) => {
    const p = await env.pagina();
    a.ok((await p.innerText('body')).includes(VERSION), VERSION);
    const t = await env.pagina({ ancho: 360, alto: 780, ruta: '/inicio' });
    a.strictEqual(await t.$('.ver-pie'), null);
    await t.evaluate(() => { location.hash = '/mas'; });
    await t.waitForSelector('.ver-pie');
    a.ok((await t.innerText('.ver-pie')).includes(VERSION));
  }],
  ['Teléfono: barra inferior de 5 con Vender al centro', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780 });
    const n = await medidas(p, '.side .nav');
    a.deepStrictEqual(n.map(x => x.t), ['Inicio', 'Apartados', 'Vender', 'Inventario', 'Más']);
    for (const x of n) a.ok(x.w >= 44 && x.h >= 44, `${x.t} mide ${x.w}x${x.h}`);
    const lado = await p.$eval('.side', e => getComputedStyle(e).bottom);
    a.strictEqual(lado, '0px');
  }],
  ['Navegar cambia la ruta y marca el acceso activo', async (env, a) => {
    const p = await env.pagina();
    await p.click('.side .nav[aria-label="Vender"]');
    await p.waitForSelector('.side .nav[aria-label="Vender"][aria-current="true"]', { timeout: 2000 });
    a.strictEqual(await p.evaluate(() => location.hash), '#/vender');
  }],
  ['Esc cierra una ventana abierta', async (env, a) => {
    const p = await env.pagina();
    await p.click('.topbar [aria-label="Calculadora"]');
    a.ok(await p.$('.capa'));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    a.strictEqual(await p.$('.capa'), null);
  }],
  ['Atrás cierra la ventana sin cambiar de pantalla', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/vender' });
    await p.click('.topbar [aria-label="Calculadora"]');
    a.ok(await p.$('.capa'));
    await p.goBack();
    await p.waitForTimeout(300);
    a.strictEqual(await p.$('.capa'), null);
    a.strictEqual(await p.evaluate(() => location.hash), '#/vender');
  }],
  ['Teléfono: la barra inferior no brinca al cambiar de sección (el ancho de la página no cambia)', async (env, a) => {
    const p = await env.pagina({ movil: true });
    for (const ruta of ['/apartados', '/inventario', '/mas', '/inicio']) {
      const anchos = await p.evaluate(r => new Promise(res => {
        const m = new Set(); const t0 = performance.now();
        const paso = () => { m.add(innerWidth + '/' + document.documentElement.scrollWidth); if (performance.now() - t0 < 450) requestAnimationFrame(paso); else res([...m]); };
        location.hash = r; requestAnimationFrame(paso);
      }), ruta);
      a.deepStrictEqual(anchos, ['412/412'], `al ir a ${ruta}: ${anchos.join(', ')}`);
    }
  }],
  ['Teléfono: al escribir, la página se ajusta al teclado y se esconde la barra inferior', async (env, a) => {
    const p = await env.pagina({ movil: true, ruta: '/vender', caja: true });
    a.match(await p.getAttribute('meta[name="viewport"]', 'content'), /interactive-widget=resizes-content/);
    a.ok(await p.isVisible('.side'));
    await p.focus('.buscar-caja .inp');
    await p.waitForFunction(() => getComputedStyle(document.querySelector('.side')).display === 'none', null, { timeout: 2000 });
    await p.evaluate(() => document.activeElement.blur());
    await p.waitForFunction(() => getComputedStyle(document.querySelector('.side')).display !== 'none', null, { timeout: 2000 });
  }],
  ['Los campos no ofrecen el autocompletado del navegador', async (env, a) => {
    const p = await env.pagina({ ruta: '/vender', caja: true });
    const sin = await p.$$eval('input:not([type=checkbox]):not([type=radio]):not([type=file])', els => els.filter(e => e.getAttribute('autocomplete') !== 'off').map(e => e.outerHTML.slice(0, 80)));
    a.deepStrictEqual(sin, []);
  }],
  ['Teléfono: "Más" no repite la calculadora (ya está en la cabecera)', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/mas' });
    a.strictEqual(await p.$('.lista-mas >> text=Calculadora'), null);
  }],
  ['Sin errores en consola', async (env, a) => {
    const p = await env.pagina();
    await p.waitForTimeout(300);
    a.deepStrictEqual(p.errores, []);
  }],
  ['Atrás como en una app: Ajustes → Más → Inicio; pestañas vuelven a Inicio; lo guardado no se pierde', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/inicio' });
    const r = () => p.evaluate(() => location.hash);
    const nav = async n => { await p.click(`.side .nav[aria-label="${n}"]`); await p.waitForTimeout(150); };
    const atras = async () => { await p.goBack(); await p.waitForTimeout(250); };
    await nav('Más'); await p.click('.lista-mas .fila-btn:has-text("Ajustes")'); await p.waitForTimeout(150);
    await p.fill('#aj-cop', '3.200'); await p.click('#aj-guardar'); await p.waitForTimeout(200);
    await atras(); a.strictEqual(await r(), '#/mas');
    await atras(); a.strictEqual(await r(), '#/inicio');
    await nav('Apartados'); await nav('Inventario'); await atras(); a.strictEqual(await r(), '#/inicio');
    await nav('Más'); await p.click('.lista-mas .fila-btn:has-text("Caja")'); await p.waitForTimeout(150);
    await nav('Vender'); await atras(); a.strictEqual(await r(), '#/inicio');
    await p.reload(); await p.waitForFunction(() => window.__pos?.ctx?.tasas?.copPorUsd);
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.tasas.copPorUsd), 3200, 'la demostración conserva lo guardado');
  }],
]);
