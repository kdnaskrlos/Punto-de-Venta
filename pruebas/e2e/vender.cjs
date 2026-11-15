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
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await agregar(p, 'Buzo Etanol Caballero Gris', 'M', 2);
    await agregar(p, 'Franela AS Niño Blanco', '6', 2);
    a.ok((await texto(p, '.aviso-tramo')).includes('Con 2 prendas más pasan a precio 6–11'));
    await agregar(p, 'Franela AS Niño Blanco', '8', 2);
    a.strictEqual(await p.$$eval('.zona-carrito .linea.mini', e => e.length), 3, 'con más de 2 prendas el carrito se compacta');
    for (const sku of ['B-M', 'F-B-6', 'F-B-8']) {
      await p.click(`.zona-carrito .linea[data-sku="${sku}"].mini`);
      a.ok((await texto(p, `.zona-carrito .linea[data-sku="${sku}"] .lc-tramo`)).includes('6–11'), sku);
    }
    a.strictEqual(await texto(p, '.barra-cobro .total-cop'), '186.000');
    a.ok((await texto(p, '.barra-cobro .tc-eq')).includes('47,70'));
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
  ['v1.97 · Teléfono: al agregar se limpia la búsqueda, la prenda queda en el carrito y la barra de cobro fija muestra total, Cobrar, Descuento y Apartar', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', caja: true, ruta: '/vender' });
    a.strictEqual(await p.isVisible('.lado-carrito'), false, 'sin prendas no hay barra');
    await agregar(p, 'Buzo Etanol Caballero Gris', 'S', 1);
    a.strictEqual(await p.inputValue('#buscar'), '');
    a.strictEqual(await p.isVisible('.rejilla'), false, 'la lista se oculta');
    a.ok(await p.isVisible('.zona-carrito .linea[data-sku="B-S"]'));
    a.strictEqual(await texto(p, '.barra-cobro .total-cop'), '48.000');
    a.deepStrictEqual(await p.$$eval('.barra-cobro button', b => b.map(x => x.textContent.trim())), ['Descuento', 'Apartar', 'Cobrar']);
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
    // v1.99: nombre sin el género; el género va con el color y la talla; el tramo en texto verde (sin pastilla); «COP» del color del precio.
    a.strictEqual(await texto(p, '.zona-carrito .linea .linea-info > b'), 'Jogger Texcol');
    a.strictEqual(await texto(p, '.zona-carrito .linea .lc-chip'), 'Caballero · Negro · Talla M');
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
  ['v1.97 · Computadora: carrito a la izquierda y columna derecha con total, Cobrar, Descuento y Apartar', async (env, a) => {
    const p = await env.pagina({ ancho: 1440, alto: 900, usuario: 'vendedora', caja: true, ruta: '/vender' });
    a.strictEqual(await p.isVisible('.lado-carrito'), false, 'sin prendas, sin columna');
    await agregar(p, 'Jogger Texcol Caballero Negro', 'M', 1);
    const r = await p.evaluate(() => { const l = document.querySelector('.zona-carrito .linea').getBoundingClientRect(), d = document.querySelector('.lado-carrito').getBoundingClientRect(), c = document.querySelector('.barra-cobro .cobrar').getBoundingClientRect(), t = document.querySelector('.barra-cobro .bco-total').getBoundingClientRect(); return [l.right < d.left, Math.round(innerWidth - d.right), t.bottom <= c.top, getComputedStyle(document.querySelector('.lado-carrito')).position !== 'fixed']; });
    a.deepStrictEqual(r, [true, 0, true, true]);
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
  ['v1.99 · Barra de cobro: total a la derecha y Descuento · Apartar · Cobrar en una línea (teléfono y computadora); «Todos los productos» al centro', async (env, a) => {
    for (const opc of [{ movil: true }, { ancho: 1440, alto: 900 }]) {
      const p = await env.pagina({ ...opc, usuario: 'vendedora', caja: true, ruta: '/vender' });
      const v = await p.$eval('#todos-productos', b => { const r = b.getBoundingClientRect(), s = document.querySelector('.vender-main .buscador').getBoundingClientRect(), n = document.querySelector('.side').getBoundingClientRect(); const fin = innerWidth < 840 ? n.top : innerHeight; return Math.abs((r.top + r.bottom) / 2 - (s.bottom + fin) / 2); });
      a.ok(v < 40, 'centrado en el espacio libre: ' + v);
      await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'J-M', cantidad: 1 }], descuento: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
      await p.waitForTimeout(400);
      const r = await p.evaluate(() => { const q = s => document.querySelector('.barra-cobro ' + s).getBoundingClientRect(); const d = q('#car-descuento'), ap = q('.apartar'), c = q('.cobrar'), t = q('.bco-total'), b = document.querySelector('.barra-cobro').getBoundingClientRect();
        return { linea: Math.abs(d.top - ap.top) < 2 && Math.abs(ap.top - c.top) < 2, orden: d.left < ap.left && ap.left < c.left, derecha: Math.abs(t.right - b.right) < 2, arriba: t.bottom <= d.top }; });
      a.deepStrictEqual(r, { linea: true, orden: true, derecha: true, arriba: true });
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
  ['v2.00 · Ajustes: sin aviso flotante en ninguna pestaña; en Tasas un ícono verde solo indica cambios; Binance verde', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 844, ruta: '/ajustes' });
    a.strictEqual(await p.isVisible('#aj-pendiente'), false);
    await p.fill('#aj-cop', '4.000');
    a.ok(await p.isVisible('#aj-pendiente')); await p.waitForTimeout(300);
    a.strictEqual(await p.$('.aviso-guardar'), null, 'sin aviso flotante');
    a.strictEqual(await p.$eval('#aj-pendiente', e => e.tagName), 'SPAN', 'no es un botón');
    a.strictEqual(await p.$eval('#aj-pendiente', e => getComputedStyle(e).color), 'rgb(21, 128, 61)');
    const fila = await p.evaluate(() => { const l = document.querySelector('label[for="aj-cop"]').getBoundingClientRect(), i = document.querySelector('#aj-pendiente').getBoundingClientRect(); return Math.abs((l.top + l.bottom) / 2 - (i.top + i.bottom) / 2); });
    a.ok(fila < 3, 'alineado con el título: ' + fila);
    a.strictEqual(await p.$eval('.modo-bs[data-modo=binance] .modo-txt b', e => getComputedStyle(e).color), 'rgb(21, 128, 61)');
    a.strictEqual(new Set(await p.$$eval('.modo-bs .modo-txt b', b => b.map(x => getComputedStyle(x).color))).size, 3);
    await p.click('#aj-tab-venta'); await p.fill('#aj-com-0-normal', '5.000').catch(() => {});
    a.strictEqual(await p.$('.aviso-guardar'), null);
    await p.click('#aj-guardar');
    await p.waitForFunction(() => document.querySelector('#aj-pendiente').hidden);
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
]);
