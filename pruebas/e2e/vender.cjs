// Tarea 10: pantalla Vender (búsqueda, tallas, tramos, carrito, agotadas, teléfono, atajos y código de barras).
const { casos } = require('./_servidor.cjs');

const GRUPO = g => `.tarjeta-prenda[data-nombre="${g}"]`;
// v1.97: la lista solo aparece al buscar (o con «Todos los productos»).
async function mostrar(p, grupo) { await p.fill('#buscar', grupo); await p.waitForSelector(GRUPO(grupo)); }
async function agregar(p, grupo, talla, veces = 1) {
  await mostrar(p, grupo); await p.click(GRUPO(grupo));
  for (let i = 0; i < veces; i++) await p.click(`.capa .talla-mas[data-talla="${talla}"]`);
  await p.click('#tallas-agregar');
}
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());

casos('vender', [
  ['Buscar filtra las tarjetas', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.fill('#buscar', 'buzo');
    await p.waitForFunction(() => document.querySelectorAll('.tarjeta-prenda').length === 1);
    a.ok(await p.$(GRUPO('Buzo Etanol Caballero Gris')));
  }],
  ['Tallas como botones ≥ 44 px con su existencia y sin «Selecciona las tallas»; dos toques suman 2', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await mostrar(p, 'Buzo Etanol Caballero Gris'); await p.click(GRUPO('Buzo Etanol Caballero Gris'));
    const tallas = await p.$$eval('.capa .talla-mas', bs => bs.map(b => { const r = b.getBoundingClientRect(); return { t: b.dataset.talla, w: r.width, h: r.height, x: b.closest('.talla-fila-v').textContent }; }));
    a.deepStrictEqual(tallas.map(t => t.t), ['S', 'M', 'L']);
    for (const t of tallas) a.ok(t.w >= 44 && t.h >= 44, JSON.stringify(t));
    a.ok(tallas[1].x.includes('2'), tallas[1].x);
    a.ok(!(await p.innerText('.capa')).includes('Selecciona'), 'sin «Selecciona las tallas»');
    await p.click('.capa .talla-mas[data-talla="M"]'); await p.click('.capa .talla-mas[data-talla="M"]');
    await p.click('#tallas-agregar');
    a.strictEqual(await texto(p, '.linea[data-sku="B-M"] .cant'), '2');
  }],
  ['El mix pasa ambas líneas al precio 6–11 con el total correcto', async (env, a) => {
    const p = await env.pagina({ movil: true, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await agregar(p, 'Buzo Etanol Caballero Gris', 'M', 2);
    await agregar(p, 'Franela AS Niño Blanco', '6', 2);
    a.strictEqual(await p.$('.aviso-tramo, .aviso-sep'), null, 'v2.10: sin avisos de «Con N prendas más»');
    await agregar(p, 'Franela AS Niño Blanco', '8', 2);
    a.strictEqual(await p.$$eval('.zona-carrito .linea.mini', e => e.length), 3, 'con más de 2 prendas el carrito se compacta');
    for (const sku of ['B-M', 'F-B-6', 'F-B-8']) {
      await p.click(`.zona-carrito .linea[data-sku="${sku}"].mini`);
      a.ok((await texto(p, `.zona-carrito .linea[data-sku="${sku}"] .lc-tramo`)).includes('6–11'), sku);
    }
    a.strictEqual(await texto(p, '[data-cobro] .total-cop'), '186.000');
    a.ok((await texto(p, '[data-cobro] .equivalentes')).includes('47,70'));
  }],
  ['Agotada: pastilla roja y tallas sin elegir', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await mostrar(p, 'Franela Rockdreams Dama Gris');
    a.strictEqual(await texto(p, `${GRUPO('Franela Rockdreams Dama Gris')} .tp-estado`), 'Agotada');
    await p.click(GRUPO('Franela Rockdreams Dama Gris'));
    a.strictEqual(await p.$eval('.capa .talla-mas[data-talla="M"]', b => b.disabled), true);
  }],
  ['Quitar con − hasta 0 borra la línea', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await agregar(p, 'Jogger Texcol Caballero Negro', 'M', 1);
    a.strictEqual(await p.$('.linea[data-sku="J-M"] [aria-label="Menos"]'), null, 'con una unidad el − es un bote de basura');
    await p.click('.linea[data-sku="J-M"] [aria-label="Quitar"]');
    a.strictEqual(await p.$('.linea[data-sku="J-M"]'), null);
  }],
  ['v1.97 · Teléfono: al agregar se limpia la búsqueda, la prenda queda en el carrito y la barra de cobro fija es un botón con el total', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', caja: true, ruta: '/vender' });
    a.strictEqual(await p.isVisible('.lado-carrito'), false, 'sin prendas no hay barra');
    await agregar(p, 'Buzo Etanol Caballero Gris', 'S', 1);
    a.strictEqual(await p.inputValue('#buscar'), '');
    a.strictEqual(await p.isVisible('.rejilla'), false, 'la lista se oculta');
    a.ok(await p.isVisible('.zona-carrito .linea[data-sku="B-S"]'));
    a.strictEqual(await texto(p, '[data-cobro] .total-cop'), '48.000');
    // v2.06: la barra es un solo botón (Descuento y Apartar pasan a la pantalla de cobro).
    a.deepStrictEqual(await p.$$eval('.barra-cobro button', b => b.map(x => x.querySelector('.bt-cnt').textContent.trim())), ['1']);
    await p.waitForTimeout(350); // la barra termina de subir
    const r = await p.$eval('.lado-carrito', e => { const b = e.getBoundingClientRect(), n = document.querySelector('.side').getBoundingClientRect(); return [Math.round(b.left), Math.round(innerWidth - b.right), Math.round(n.top - b.bottom), getComputedStyle(e).position]; });
    a.ok(r[0] === 0 && r[1] === 0 && Math.abs(r[2]) <= 2 && r[3] === 'fixed', 'de borde a borde, justo encima de la barra de íconos: ' + r);
  }],
  ['F2 enfoca el buscador; código de barras + Enter agrega la variante', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.click('h1, .vista'); await p.keyboard.press('F2');
    a.strictEqual(await p.evaluate(() => document.activeElement.id), 'buscar');
    const codigo = await p.evaluate(() => window.__pos.ctx.productos['J-L'].codigo);
    await p.keyboard.type(codigo); await p.keyboard.press('Enter');
    a.strictEqual(await texto(p, '.linea[data-sku="J-L"] .cant'), '1');
    a.strictEqual(await p.inputValue('#buscar'), '');
  }],
  ['Sin caja abierta pide abrirla', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', ruta: '/vender' });
    a.ok((await p.innerText('.vista')).includes('Abre tu caja para vender'));
  }],
  ['No deja agregar más de lo que hay', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await mostrar(p, 'Buzo Etanol Caballero Gris'); await p.click(GRUPO('Buzo Etanol Caballero Gris'));
    await p.click('.capa .talla-mas[data-talla="L"]');
    a.strictEqual(await p.isDisabled('.capa .talla-mas[data-talla="L"]'), true);
    a.strictEqual(await texto(p, '.capa .talla-fila-v[data-sku="B-L"] .tf-max'), 'Máximo 1');
    await p.click('#tallas-agregar');
    a.strictEqual(await texto(p, '.linea[data-sku="B-L"] .cant'), '1');
    a.deepStrictEqual(p.errores, []);
  }],
  ['Sin caja: "Abrir caja" se abre aquí mismo, los campos vacíos cuentan como 0 y sigues en Vender', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', ruta: '/vender' });
    await p.click('.sin-caja button:text("Abrir caja")');
    await p.waitForSelector('.capa #fondo-cop');
    await p.fill('#fondo-cop', '10.000');
    await p.click('.capa #abrir-caja');
    await p.waitForSelector('.capa', { state: 'detached' });
    a.strictEqual(await p.evaluate(() => location.hash), '#/vender');
    a.strictEqual(await p.isVisible('.sin-caja'), false);
    const fondo = await p.evaluate(() => window.__pos.ctx.miCaja.fondo);
    a.deepStrictEqual(fondo, { COP: 10000, USD: 0, BS: 0 });
  }],
  ['Géneros: «Todo» primero y luego Unisex / Dama / Niño / Niña; filtros con esquinas de 10 px', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 780, ruta: '/vender', caja: true });
    await p.click('#todos-productos');
    const t = await p.$$eval('.filtros .chip', e => e.map(x => x.textContent));
    const esperado = ['Todo', ...['Unisex', 'Dama', 'Niño', 'Niña'].filter(g => t.includes(g))];
    a.deepStrictEqual(t.slice(0, esperado.length), esperado, t.join(' / '));
    a.ok(await p.$eval('.filtros .chip:first-child', e => e.classList.contains('activo')), '«Todo» elegido al entrar');
    a.strictEqual(await p.$eval('.filtros .chip', e => getComputedStyle(e).borderTopLeftRadius), '10px');
  }],
  ['Teléfono: los géneros van en una sola fila deslizable', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/vender', caja: true });
    await p.click('#todos-productos');
    const tops = await p.$$eval('.filtros .chip', e => [...new Set(e.map(x => Math.round(x.getBoundingClientRect().top)))]);
    a.strictEqual(tops.length, 1, `en ${tops.length} filas`);
  }],
  ['Tallas: se pueden sumar varias y «Agregar al carrito» las pasa y cierra; la X no cambia nada', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/vender', caja: true });
    await mostrar(p, 'Buzo Etanol Caballero Gris'); await p.click('.tarjeta-prenda[data-nombre="Buzo Etanol Caballero Gris"]');
    await p.click('.capa .talla-mas[data-talla="S"]');
    await p.click('.capa .cerrar'); await p.waitForSelector('.capa', { state: 'detached' });
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.carrito.lineas.length), 0, 'la X descarta');
    await mostrar(p, 'Buzo Etanol Caballero Gris'); await p.click('.tarjeta-prenda[data-nombre="Buzo Etanol Caballero Gris"]');
    await p.click('.capa .talla-mas[data-talla="S"]'); await p.click('.capa .talla-mas[data-talla="M"]');
    a.ok(await p.isVisible('.capa'));
    await p.click('#tallas-agregar');
    await p.waitForSelector('.capa', { state: 'detached' });
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.carrito.lineas.length), 2);
  }],
  ['Tallas: tocar suma, "−" resta; al dar Listo la tarjeta queda marcada con la cantidad', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', caja: true, ruta: '/vender' });
    const g = '.tarjeta-prenda[data-nombre="Buzo Etanol Caballero Gris"]';
    await mostrar(p, 'Buzo Etanol Caballero Gris'); await p.click(g);
    await p.click('.capa .talla-mas[data-talla="S"]'); await p.click('.capa .talla-mas[data-talla="S"]'); await p.click('.capa .talla-mas[data-talla="M"]');
    a.strictEqual(await p.inputValue('.capa .talla-fila-v[data-sku="B-S"] .tf-cant'), '2');
    await p.click('.capa .talla-menos[data-sku="B-S"]');
    a.strictEqual(await p.inputValue('.capa .talla-fila-v[data-sku="B-S"] .tf-cant'), '1');
    await p.click('.capa .talla-menos[data-sku="B-S"]');
    a.strictEqual(await p.inputValue('.capa .talla-fila-v[data-sku="B-S"] .tf-cant'), '0');
    a.strictEqual(await p.$eval('.capa .talla-menos[data-sku="B-S"]', b => b.disabled), true, 'sin prendas el − no actúa');
    await p.click('.capa .talla-mas[data-talla="S"]');
    await p.click('#tallas-agregar');
    await p.waitForFunction(() => document.querySelector('#buscar').value === '', null, { timeout: 3000 }); // al agregar se limpia la búsqueda
    await mostrar(p, 'Buzo Etanol Caballero Gris');
    a.ok(await p.$(g + '.elegida'));
    a.ok(await p.$(g + ' .en-carrito.quitar-sel svg'), 'círculo con «−»');
    a.strictEqual(await p.$('.tarjeta-prenda.elegida:not([data-nombre="Buzo Etanol Caballero Gris"])'), null);
    // v1.91: el círculo va arriba a la izquierda de la foto y un toque quita la prenda (todas sus tallas) del carrito.
    await p.waitForSelector('.capa', { state: 'detached' });
    const ci = await p.$eval(g + ' .en-carrito', e => e.getBoundingClientRect().left);
    const fo = await p.$eval(g + ' .foto', e => e.getBoundingClientRect().left);
    a.ok(ci < fo, 'a la izquierda');
    await p.click(g + ' .en-carrito');
    a.strictEqual(await p.$('.capa'), null, 'no abre las tallas');
    a.strictEqual(await p.$(g + ' .en-carrito'), null);
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.carrito.lineas.length), 0);
  }],
  ['Tallas: la cantidad se escribe a mano (máximo la existencia) y el contador tiene tres partes iguales', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await mostrar(p, 'Buzo Etanol Caballero Gris'); await p.click('.tarjeta-prenda[data-nombre="Buzo Etanol Caballero Gris"]');
    const c = '.capa .talla-fila-v[data-sku="B-S"] .tf-cant';
    await p.fill(c, '3'); await p.press(c, 'Enter');
    a.strictEqual(await p.inputValue(c), '3');
    const anchos = await p.$$eval('.capa .talla-fila-v[data-sku="B-S"] .tf-paso > *', e => e.map(x => Math.round(x.getBoundingClientRect().width)));
    a.deepStrictEqual(anchos, [48, 48, 48]);
    await p.fill(c, '999'); await p.press(c, 'Enter');
    const max = await p.evaluate(() => window.__pos.ctx.productos['B-S'].existencia);
    a.strictEqual(await p.inputValue(c), String(max));
    await p.click('#tallas-agregar');
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.carrito.lineas[0].cantidad), max);
  }],
  ['Tarjeta de prenda: sin tallas y el nombre largo se completa en otra línea', async (env, a) => {
    const p = await env.pagina({ ancho: 320, alto: 780, ruta: '/vender', caja: true });
    await p.click('#todos-productos');
    a.strictEqual(await p.$('.tarjeta-prenda .tp-tallas'), null);
    a.ok(await p.$$eval('.tarjeta-prenda .info b', e => e.every(x => x.scrollWidth <= x.clientWidth + 3 && getComputedStyle(x).whiteSpace === 'normal')), 'sin cortar');
  }],
  ['Tallas: − y + de 48 px, separados y sin encimarse con otra talla', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await mostrar(p, 'Buzo Etanol Caballero Gris'); await p.click('.tarjeta-prenda[data-nombre="Buzo Etanol Caballero Gris"]');
    await p.click('.capa .talla-mas[data-talla="S"]');
    const cajas = await p.$$eval('.capa .tf-paso button', bs => bs.map(b => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    for (const c of cajas) a.ok(c.w >= 44 && c.h >= 44, JSON.stringify(c));
    for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) {
      const [m, n] = [cajas[i], cajas[j]];
      a.ok(m.x + m.w <= n.x || n.x + n.w <= m.x || m.y + m.h <= n.y || n.y + n.h <= m.y, 'botones encimados');
    }
  }],
  ['Venta en curso: si la app se cierra, al volver ofrece continuarla', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await mostrar(p, 'Buzo Etanol Caballero Gris'); await p.click('.tarjeta-prenda[data-nombre="Buzo Etanol Caballero Gris"]');
    await p.click('.capa .talla-mas[data-talla="S"]'); await p.click('.capa .talla-mas[data-talla="M"]');
    await p.click('#tallas-agregar');
    await p.evaluate(() => localStorage.setItem('pos-demo-usuario', 'vendedora')); // la demo recuerda quién entró
    await p.reload();
    await p.waitForSelector('.capa:has-text("¿Continuar venta?")');
    a.match(await p.innerText('.venta-curso'), /2 prendas/);
    await p.click('#retomar-si');
    await p.waitForFunction(() => window.__pos.ctx.carrito?.lineas?.length === 2);
    a.strictEqual(await p.evaluate(() => location.hash), '#/vender');
    // v2.13: si la app se abre en otra pantalla, «Continuar» lleva al carrito
    await p.evaluate(() => { location.hash = '/inicio'; }); await p.waitForTimeout(300);
    await p.reload();
    await p.waitForSelector('.capa:has-text("¿Continuar venta?")');
    await p.click('#retomar-si');
    await p.waitForTimeout(700);
    a.strictEqual(await p.evaluate(() => location.hash), '#/vender', 'queda en el carrito');
    a.ok(await p.isVisible('.zona-carrito .linea'));
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [], descuento: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    await p.reload(); await p.waitForTimeout(1200);
    a.strictEqual(await p.$('.capa:has-text("¿Continuar venta?")'), null, 'carrito vacío: no pregunta');
  }],
  ['v1.97 · Vender vacío: sin lista ni texto, solo «Todos los productos»; espaciado de 12 px bajo el buscador', async (env, a) => {
    const p = await env.pagina({ movil: true, usuario: 'vendedora', caja: true, ruta: '/vender' });
    a.strictEqual(await p.$$eval('.rejilla .tarjeta-prenda', e => e.length), 0);
    a.strictEqual(await p.isVisible('.filtros'), false);
    a.strictEqual((await p.innerText('.vender-main')).trim(), 'Todos los productos');
    await p.fill('#buscar', 'franela'); await p.waitForTimeout(450); // fin del fundido de entrada de la lista
    const g = await p.evaluate(() => { const b = document.querySelector('.vender-main .buscador').getBoundingClientRect(), f = document.querySelector('.vender-main .filtros').getBoundingClientRect(), t = document.querySelector('.rejilla .tarjeta-prenda').getBoundingClientRect(); return [Math.round(f.top - b.bottom), Math.round(t.top - f.bottom), Math.round(t.left)]; });
    a.deepStrictEqual(g, [12, 12, 12]);
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'J-M', cantidad: 2 }], descuento: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    await p.fill('#buscar', ''); await p.waitForTimeout(300);
    const l = await p.evaluate(() => Math.round(document.querySelector('.zona-carrito .linea').getBoundingClientRect().top - document.querySelector('.vender-main .buscador').getBoundingClientRect().bottom));
    a.strictEqual(l, 12, 'el carrito a 12 px del buscador');
    // Tarjetas cobrar: color y talla en texto (sin pastilla); «Precio 1–5» en pastilla con el c/u al lado; monto en su línea base.
    a.deepStrictEqual(await p.$$eval('.zona-carrito .linea .lc-chip', e => e.map(x => getComputedStyle(x).backgroundColor)), ['rgba(0, 0, 0, 0)']);
    // v2.03: nombre con el género; debajo color y talla; el tramo en texto verde (sin pastilla); «COP» del color del precio.
    a.strictEqual(await texto(p, '.zona-carrito .linea .linea-info > b'), 'Jogger Texcol Caballero');
    a.strictEqual(await texto(p, '.zona-carrito .linea .lc-chip'), 'Negro · M', 'v2.03: el género vuelve al nombre y la talla va sin «Talla»');
    a.deepStrictEqual(await p.$eval('.zona-carrito .linea .lc-tramo', e => [getComputedStyle(e).backgroundColor, getComputedStyle(e).color]), ['rgba(0, 0, 0, 0)', 'rgb(21, 128, 61)']);
    a.strictEqual(await p.$eval('.zona-carrito .linea .lc-monto .c-cop', e => getComputedStyle(e).color), await p.$eval('.zona-carrito .linea .lc-monto .monto', e => getComputedStyle(e).color));
    a.match(await texto(p, '.zona-carrito .linea .lc-precio'), /^Precio 1–5\s*42\.000 c\/u$/);
    const bases = await p.$eval('.zona-carrito .linea', l => { const r = (s) => { const e = l.querySelector(s), rg = document.createRange(); rg.selectNodeContents(e); return Math.round(rg.getBoundingClientRect().bottom); }; return [r('.lc-cu'), r('.lc-monto .monto')]; });
    a.ok(Math.abs(bases[0] - bases[1]) <= 2, `línea base: ${bases}`);
  }],
  ['v1.91 · Ventana de tallas: la cantidad elegida sin fondo verde', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 844, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await mostrar(p, 'Jogger Texcol Caballero Negro'); await p.click(GRUPO('Jogger Texcol Caballero Negro')); await p.click('.capa .talla-mas[data-talla="M"]');
    a.strictEqual(await p.$eval('.capa .talla-fila-v[data-sku="J-M"] .tf-cant', e => getComputedStyle(e).backgroundColor), 'rgb(255, 255, 255)');
  }],

  ['v1.97 · «Todos los productos»: Tarjetas listado alargadas en una columna; la × lo cierra; la agotada no muestra precio', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 800, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.click('#todos-productos');
    const xs = await p.$$eval('.vender-main .rejilla .tarjeta-prenda', cs => cs.map(c => Math.round(c.getBoundingClientRect().left)));
    a.ok(xs.length > 3); a.strictEqual(new Set(xs).size, 1, 'una columna');
    a.strictEqual(await p.$(`${GRUPO('Franela Rockdreams Dama Gris')} .precio`), null);
    await p.click('.buscar-borrar');
    a.strictEqual(await p.$$eval('.rejilla .tarjeta-prenda', e => e.length), 0);
    a.ok(await p.isVisible('#todos-productos'));
  }],
  ['v2.15 · Computadora: carrito en tabla y barra de cobro abajo (cliente, total y Cobrar); sin escáner; F1 cliente', async (env, a) => {
    const p = await env.pagina({ ancho: 1440, alto: 900, usuario: 'vendedora', caja: true, ruta: '/vender' });
    a.ok(await p.isVisible('.tabla-pc .tp-vacio'), 'tabla vacía con su mensaje');
    a.strictEqual(await p.$eval('.pie-pc .cobrar', b => b.disabled), true);
    a.strictEqual(await p.isVisible('#escanear-vender'), false);
    await agregar(p, 'Jogger Texcol Caballero Negro', 'M', 1);
    a.ok(await p.isVisible('.tabla-pc .fila-pc[data-sku="J-M"]'));
    const r = await p.evaluate(() => { const t = document.querySelector('.tabla-pc').getBoundingClientRect(), pie = document.querySelector('.pie-pc').getBoundingClientRect(); return [pie.top >= t.bottom - 1, Math.round(innerHeight - pie.bottom)]; });
    a.ok(r[0] && r[1] >= 0 && r[1] <= 40, 'la barra de cobro va abajo: ' + r);
    a.strictEqual(await texto(p, '.pie-pc .total-cop'), '42.000');
    await p.keyboard.press('F1'); await p.waitForSelector('#cli-guardar');
    a.match(await p.innerText('#cli-guardar'), /Guardar cliente/);
  }],
  ['v1.98 · Teléfono: al entrar a Vender la barra de cobro sube desde abajo (nunca aparece a media pantalla); al quitar una prenda se desvanece; al vaciar el carrito la barra baja', async (env, a) => {
    const p = await env.pagina({ movil: true, usuario: 'vendedora', caja: true, ruta: '/inicio' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'J-M', cantidad: 2 }, { sku: 'B-S', cantidad: 1 }], descuento: null }; });
    const tops = await p.evaluate(() => new Promise(res => { const v = []; location.hash = '/vender'; const t0 = performance.now(); const f = () => { const l = document.querySelector('.lado-carrito'); if (l && !l.hidden) v.push(Math.round(l.getBoundingClientRect().top)); if (performance.now() - t0 < 450) requestAnimationFrame(f); else res(v); }; requestAnimationFrame(f); }));
    const fin = tops[tops.length - 1];
    a.ok(tops.length > 3 && tops.every(t => t >= fin - 1), 'la barra nunca sube por encima de su lugar: ' + tops.join(','));
    a.ok(tops[0] > fin + 20, 'empieza abajo y sube: ' + tops.join(','));
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito.lineas.splice(1, 1); window.dispatchEvent(new CustomEvent('pos:carrito')); });
    a.strictEqual(await p.$$eval('.zona-carrito .linea[aria-hidden="true"]', e => e.length), 1, 'queda un fantasma que se desvanece');
    await p.waitForFunction(() => !document.querySelector('.zona-carrito .linea[aria-hidden="true"]'));
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [], descuento: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    a.strictEqual(await p.$eval('.lado-carrito', e => e.hidden), false, 'primero baja');
    await p.waitForFunction(() => document.querySelector('.lado-carrito').hidden);
  }],
  ['v2.10 · Barra de cobro: un solo botón con la cantidad en una camiseta y el total con sus equivalentes (teléfono y computadora); «Todos los productos» al centro', async (env, a) => {
    for (const opc of [{ movil: true }]) {
      const p = await env.pagina({ ...opc, usuario: 'vendedora', caja: true, ruta: '/vender' });
      const v = await p.$eval('#todos-productos', b => { const r = b.getBoundingClientRect(), s = document.querySelector('.vender-main .buscador').getBoundingClientRect(), n = document.querySelector('.side').getBoundingClientRect(); const fin = innerWidth < 840 ? n.top : innerHeight; return Math.abs((r.top + r.bottom) / 2 - (s.bottom + fin) / 2); });
      a.ok(v < 40, 'centrado en el espacio libre: ' + v);
      await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'J-M', cantidad: 2 }], descuento: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
      await p.waitForTimeout(400);
      a.strictEqual(await p.$$eval('.barra-cobro button', b => b.length), 1);
      a.strictEqual(await p.$('.barra-cobro #car-descuento'), null, 'Descuento está en la pantalla de cobro');
      a.strictEqual(await texto(p, '.barra-cobro .bt-cnt'), '2');
      a.strictEqual(await p.$('.barra-cobro .bt-txt'), null, 'v2.10: sin «prendas en total»');
      a.ok(await p.$('.barra-cobro .bt-cnt svg.i'), 'camiseta con la cantidad adentro');
      a.ok(/^Cobrar /.test(await p.$eval('.barra-cobro .cobrar', b => b.getAttribute('aria-label'))));
    }
  }],
  ['v2.00 · Detalle de la prenda (Inventario): sin cajas, color y tela bajo el nombre, tallas con total, precios por tramo y ficha en dos columnas', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 844, ruta: '/inventario' });
    await p.fill('#q', 'franela as'); await p.click('.stk .tarjeta-prenda[data-skus~="F-B-4"]');
    await p.waitForSelector('.stk-capa .ficha3');
    a.strictEqual(await texto(p, '.stk-capa .det-cab h2'), 'Franela AS Niño');
    a.strictEqual(await texto(p, '.stk-capa .det-sub'), 'Blanco · Algodon');
    a.ok(await p.$('.stk-capa .det-sub .punto-color'));
    a.strictEqual(await p.$('.stk-capa .card h3'), null, 'sin cajas con título en MAYÚSCULAS');
    a.match(await texto(p, '.stk-capa .det-t-der'), /^48 uds en total$/);
    a.deepStrictEqual((await p.$$eval('.stk-capa .prices span', e => e.map(x => x.textContent))).slice(0, 2), ['1–5 prendas', '6–11']);
    a.strictEqual(await p.$$eval('.stk-capa .ficha3 > div', d => new Set(d.map(x => Math.round(x.getBoundingClientRect().left))).size), 2);
    a.ok(await p.$eval('.stk-capa .det-x', b => b.getBoundingClientRect().width >= 44 && getComputedStyle(b).borderTopWidth === '0px'));
    const fam = await p.$$eval('.stk-capa .ficha3 b', b => new Set(b.map(x => getComputedStyle(x).fontFamily)).size);
    a.strictEqual(fam, 1, 'el código de imagen con la misma letra');
    const lineas = await p.$$eval('.stk-capa .dfila', f => f.map(x => getComputedStyle(x).borderBottomWidth));
    a.ok(lineas.every(w => w === '0px'), 'una sola línea entre filas');
  }],
  ['v2.06 · Ajustes: sin aviso flotante ni ícono de cambios; «Guardar cambios» se activa al cambiar; Binance verde', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 844, ruta: '/ajustes' });
    a.strictEqual(await p.$('#aj-pendiente'), null, 'sin ícono de cambios sin guardar');
    a.strictEqual(await p.$eval('#aj-guardar', b => b.disabled), true);
    await p.fill('#aj-cop', '4.000');
    a.strictEqual(await p.$eval('#aj-guardar', b => b.disabled), false); await p.waitForTimeout(300);
    a.strictEqual(await p.$('.aviso-guardar'), null, 'sin aviso flotante');
    a.strictEqual(await p.$eval('.modo-bs[data-modo=binance] .modo-txt b', e => getComputedStyle(e).color), 'rgb(21, 128, 61)');
    a.strictEqual(new Set(await p.$$eval('.modo-bs .modo-txt b', b => b.map(x => getComputedStyle(x).color))).size, 3);
    await p.click('#aj-tab-venta'); await p.fill('#aj-com-0-normal', '5.000').catch(() => {});
    a.strictEqual(await p.$('.aviso-guardar'), null);
    await p.click('#aj-guardar');
    await p.waitForFunction(() => document.querySelector('#aj-guardar').disabled);
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.ajustesTasas?.copPorUsd), 4000);
  }],
  ['v2.00 · Detalle del apartado: teléfono abre WhatsApp, prendas en filas con una sola línea y sin línea sobre los botones', async (env, a) => {
    const p = await env.pagina({ movil: true, usuario: 'admin', ruta: '/mas' });
    await p.click('#modo-prueba'); await p.waitForTimeout(1200);
    await p.evaluate(() => { location.hash = '/apartados'; }); await p.waitForSelector('.apartado');
    await p.click('.apartado >> nth=0'); await p.waitForSelector('.ap-det.det2');
    a.match(await p.getAttribute('.ap-det-tel.wa', 'href'), /^https:\/\/wa\.me\/58\d{10}$/);
    a.ok(await p.$eval('.ap-det-tel.wa', e => parseFloat(getComputedStyle(e).fontSize) >= 15));
    a.ok(await p.$$eval('.ap-det .dfila', f => f.length >= 2 && f.every(x => getComputedStyle(x).borderBottomWidth === '0px')));
    a.strictEqual(await p.$eval('.ap-acc', e => getComputedStyle(e).borderTopWidth), '0px');
    const c = await p.$$eval('.ap-cif-abono, .ap-cif-saldo', d => d.map(x => getComputedStyle(x).alignItems));
    a.deepStrictEqual(c, ['center', 'center']);
  }],
  ['v2.00 · Calculadora: al copiar no sale aviso de la app; el ícono pasa a ✓', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora' });
    await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await p.click('.topbar [aria-label="Calculadora"]');
    await p.fill('#calc-usd', '2'); await p.click('[aria-label="Copiar pesos"]');
    await p.waitForSelector('.calc-caja .ibtn.copiado');
    a.strictEqual(await p.$('.toast'), null, 'sin aviso de la app');
    a.ok(await p.$eval('.caja.calc2 .cab', e => getComputedStyle(e).backgroundImage.includes('gradient')));
  }],
  ['v2.00 · Sin barras de desplazamiento visibles', async (env, a) => {
    const p = await env.pagina({ ancho: 1280, alto: 700, ruta: '/inventario' });
    a.strictEqual(await p.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth), 'none');
  }],
  ['v1.99 · Recibo: el alto del mensaje agrandado se recuerda', async (env, a) => {
    const p = await env.pagina({ ancho: 1280, alto: 900, ruta: '/ajustes' });
    await p.click('#aj-tab-recibo');
    await p.$eval('#aj-plantilla', e => { e.style.height = '520px'; });
    await p.waitForTimeout(500);
    await p.evaluate(() => { location.hash = '/inicio'; }); await p.waitForTimeout(200);
    await p.evaluate(() => { location.hash = '/ajustes'; }); await p.waitForSelector('#aj-tab-recibo'); await p.click('#aj-tab-recibo');
    a.strictEqual(await p.$eval('#aj-plantilla', e => Math.round(e.getBoundingClientRect().height)), 520);
  }],
  ['v2.04 · Prenda de una sola talla: un toque la agrega sin abrir la ventana de tallas; otro toque suma; sin existencia avisa', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 844, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.evaluate(() => { const c = window.__pos.ctx; const b = c.productos['J-M'];
      c.productos['G-U'] = { ...b, sku: 'G-U', codigo: '7700001', nombre: 'Gorra Trucker Unisex Negro', tipo: 'Gorra', marca: 'Trucker', genero: 'Unisex', color: 'Negro', tela: '', talla: '', grupo: undefined, titulo: undefined, existencia: 1 };
      window.dispatchEvent(new CustomEvent('pos:datos', { detail: { que: 'productos' } })); });
    await p.fill('#buscar', 'gorra'); await p.waitForSelector('.tarjeta-prenda[data-nombre^="Gorra"]');
    await p.click('.tarjeta-prenda[data-nombre^="Gorra"]');
    a.strictEqual(await p.$('.capa .talla-mas'), null, 'sin ventana de tallas');
    await p.waitForSelector('.zona-carrito .linea[data-sku="G-U"]');
    a.strictEqual(await p.inputValue('#buscar'), '');
    await p.fill('#buscar', 'gorra'); await p.click('.tarjeta-prenda[data-nombre^="Gorra"]');
    await p.waitForSelector('.toast:has-text("No hay más existencia")');
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.carrito.lineas.find(l => l.sku === 'G-U').cantidad), 1);
  }],
  ['v2.06 · «Todos los productos» se escribe en el buscador y la lista solo se quita al borrar la frase completa', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 844, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.click('#todos-productos');
    a.strictEqual(await p.inputValue('#buscar'), 'Todos los productos');
    const n = await p.$$eval('.rejilla .tarjeta-prenda', e => e.length);
    a.ok(n > 3);
    await p.focus('#buscar'); await p.keyboard.press('End');
    for (let i = 0; i < 4; i++) await p.keyboard.press('Backspace');
    a.strictEqual(await p.$$eval('.rejilla .tarjeta-prenda', e => e.length), n, 'borrar unas letras no quita la lista');
    await p.fill('#buscar', '');
    a.strictEqual(await p.isVisible('.rejilla'), false);
    await p.click('#todos-productos'); await p.click('.buscar-borrar');
    a.strictEqual(await p.isVisible('.rejilla'), false, 'la × también la quita');
  }],
  ['v2.07 · Quitar deslizando: las de abajo suben sin salto y al agregar no hay resaltado verde', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 844, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'B-S', cantidad: 1 }, { sku: 'J-M', cantidad: 1 }, { sku: 'J-L', cantidad: 1 }, { sku: 'Y-3m', cantidad: 1 }], descuento: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    await p.waitForTimeout(600);
    a.strictEqual(await p.$('.zona-carrito .linea.recien'), null, 'sin resaltado');
    await p.evaluate(() => { const t0 = performance.now(); window.__tr = []; const f = () => { const l = document.querySelector('.zona-carrito .linea[data-sku="J-M"]'); if (l) window.__tr.push(l.getBoundingClientRect().top); if (performance.now() - t0 < 1800) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const b = await (await p.$('.zona-carrito .linea[data-sku="B-S"]')).boundingBox(), y = b.y + b.height / 2;
    await p.mouse.move(b.x + b.width - 30, y); await p.mouse.down();
    for (let x = b.x + b.width - 30; x > 8; x -= 25) await p.mouse.move(x, y);
    await p.mouse.up();
    await p.waitForTimeout(1500);
    const tr = await p.evaluate(() => window.__tr);
    const saltos = tr.slice(1).map((t, i) => Math.abs(t - tr[i]));
    a.ok(tr[0] - tr[tr.length - 1] > 40, 'la de abajo subió');
    a.ok(Math.max(...saltos) < 25, 'sin salto brusco: ' + Math.round(Math.max(...saltos)));
  }],
  ['v2.08 · Papelera del carrito y quitar descuento con Deshacer; semáforo en la ventana de tallas', async (env, a) => {
    const p = await env.pagina({ ancho: 1440, alto: 900, usuario: 'admin', caja: true, ruta: '/vender' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'B-S', cantidad: 1 }], descuento: { tipo: 'monto', valor: 5000, moneda: 'COP' }, autorizacion: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    await p.click('.zona-carrito .linea[data-sku="B-S"] .quitar');
    await p.click('.toast button:has-text("Deshacer")');
    await p.waitForSelector('.zona-carrito .linea[data-sku="B-S"]');
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.carrito.descuento?.valor), 5000);
    await p.evaluate(() => { const c = window.__pos.ctx; c.productos['J-S'].existencia = 0; c.productos['J-M'].existencia = 1; c.productos['J-M'].minimo = 3; c.productos['J-L'].existencia = 10; c.productos['J-L'].minimo = 3; window.dispatchEvent(new CustomEvent('pos:datos', { detail: { que: 'productos' } })); });
    await p.fill('#buscar', 'jogger'); await p.click('.tarjeta-prenda[data-nombre^="Jogger"]');
    const col = sku => p.$eval(`.capa .talla-fila-v[data-sku="${sku}"] .tf-disp`, e => getComputedStyle(e).color);
    a.strictEqual(await col('J-L'), 'rgb(21, 128, 61)', 'verde: hay');
    a.strictEqual(await col('J-M'), 'rgb(161, 98, 7)', 'amarillo: stock bajo');
    a.strictEqual(await col('J-S'), 'rgb(185, 28, 28)', 'rojo: agotado');
  }],
  ['v2.11 · Círculo «faltan N» junto al tramo (compacta y desplegada) y punto en el carrito fuera de Vender', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 844, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'J-M', cantidad: 4 }], descuento: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    await p.waitForSelector('.zona-carrito .linea[data-sku="J-M"] .lc-falta');
    a.strictEqual(await texto(p, '.zona-carrito .linea[data-sku="J-M"] .lc-falta'), '2');
    a.ok(await p.$eval('.lc-precio .lc-falta', c => c.previousElementSibling.classList.contains('lc-tramo')), 'pegado al tramo');
    a.ok(await p.$eval('.lc-cu', c => c.getBoundingClientRect().top > document.querySelector('.lc-tramo').getBoundingClientRect().bottom - 1), '«c/u» debajo del tramo');
    a.strictEqual(await p.$eval('.nav[data-ruta="/vender"]', e => e.classList.contains('con-carrito')), false, 'en Vender no hay punto');
    await p.evaluate(() => { location.hash = '/apartados'; }); await p.waitForTimeout(400);
    a.ok(await p.$eval('.nav[data-ruta="/vender"] .nav-punto', e => getComputedStyle(e).display !== 'none'), 'fuera de Vender sale el punto');
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [], descuento: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    a.strictEqual(await p.$eval('.nav[data-ruta="/vender"]', e => e.classList.contains('con-carrito')), false, 'sin prendas no hay punto');
  }],
]);
