// Tarea 10: pantalla Vender (búsqueda, tallas, tramos, carrito, agotadas, teléfono, atajos y código de barras).
const { casos } = require('./_servidor.cjs');

const GRUPO = g => `.tarjeta-prenda[data-grupo="${g}"]`;
async function agregar(p, grupo, talla, veces = 1) {
  await p.click(GRUPO(grupo));
  for (let i = 0; i < veces; i++) await p.click(`.capa .talla-mas[data-talla="${talla}"]`);
  await p.click('#tallas-agregar');
}
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());

casos('vender', [
  ['Buscar filtra las tarjetas', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.fill('#buscar', 'buzo');
    await p.waitForFunction(() => document.querySelectorAll('.tarjeta-prenda').length === 1);
    a.ok(await p.$(GRUPO('Buzo Etanol Gris')));
  }],
  ['Tallas como botones ≥ 44 px con su existencia; dos toques suman 2', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.click(GRUPO('Buzo Etanol Gris'));
    const tallas = await p.$$eval('.capa .talla-mas', bs => bs.map(b => { const r = b.getBoundingClientRect(); return { t: b.dataset.talla, w: r.width, h: r.height, x: b.closest('.talla-fila-v').textContent }; }));
    a.deepStrictEqual(tallas.map(t => t.t), ['S', 'M', 'L']);
    for (const t of tallas) a.ok(t.w >= 44 && t.h >= 44, JSON.stringify(t));
    a.ok(tallas[1].x.includes('2'), tallas[1].x);
    await p.click('.capa .talla-mas[data-talla="M"]'); await p.click('.capa .talla-mas[data-talla="M"]');
    await p.click('#tallas-agregar');
    a.strictEqual(await texto(p, '.linea[data-sku="B-M"] .cant'), '2');
  }],
  ['El mix pasa ambas líneas al precio 6–11 con el total correcto', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await agregar(p, 'Buzo Etanol Gris', 'M', 2);
    await agregar(p, 'Franela AS Niño Blanco', '6', 2);
    a.ok((await texto(p, '.aviso-tramo')).includes('Con 2 prendas más pasan a precio 6–11'));
    await agregar(p, 'Franela AS Niño Blanco', '8', 2);
    a.strictEqual(await p.$$eval('.lado-carrito .linea.mini', e => e.length), 3, 'con más de 2 prendas el carrito se compacta');
    for (const sku of ['B-M', 'F-B-6', 'F-B-8']) {
      await p.click(`.lado-carrito .linea[data-sku="${sku}"].mini`);
      a.ok((await texto(p, `.lado-carrito .linea[data-sku="${sku}"] .tramo`)).includes('6–11'), sku);
    }
    a.strictEqual(await texto(p, '.carrito .total-cop'), '186.000');
    a.ok((await texto(p, '.carrito .equivalentes')).includes('47,70'));
  }],
  ['Agotada: pastilla roja y tallas sin elegir', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    a.strictEqual(await texto(p, `${GRUPO('Franela Rockdreams Gris')} .tp-estado`), 'Agotada');
    await p.click(GRUPO('Franela Rockdreams Gris'));
    a.strictEqual(await p.$eval('.capa .talla-mas[data-talla="M"]', b => b.disabled), true);
  }],
  ['Quitar con − hasta 0 borra la línea', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await agregar(p, 'Jogger Texcol Negro', 'M', 1);
    a.strictEqual(await p.$('.linea[data-sku="J-M"] [aria-label="Menos"]'), null, 'con una unidad el − es un bote de basura');
    await p.click('.linea[data-sku="J-M"] [aria-label="Quitar"]');
    a.strictEqual(await p.$('.linea[data-sku="J-M"]'), null);
  }],
  ['Teléfono: barra verde abre el carrito', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await agregar(p, 'Buzo Etanol Gris', 'S', 1);
    a.ok((await texto(p, '.barra-carrito')).includes('1 prenda'));
    a.ok((await texto(p, '.barra-carrito')).includes('48.000'));
    await p.click('.barra-carrito');
    await p.waitForSelector('.capa .linea[data-sku="B-S"]');
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
    await p.click(GRUPO('Buzo Etanol Gris'));
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
  ['Teléfono: las categorías van en una sola fila deslizable', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/vender', caja: true });
    const tops = await p.$$eval('.filtros .chip', e => [...new Set(e.map(x => Math.round(x.getBoundingClientRect().top)))]);
    a.strictEqual(tops.length, 1, `en ${tops.length} filas`);
  }],
  ['Tallas: se pueden sumar varias y «Agregar al carrito» las pasa y cierra; la X no cambia nada', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/vender', caja: true });
    await p.click('.tarjeta-prenda[data-grupo="Buzo Etanol Gris"]');
    await p.click('.capa .talla-mas[data-talla="S"]');
    await p.click('.capa .cerrar'); await p.waitForSelector('.capa', { state: 'detached' });
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.carrito.lineas.length), 0, 'la X descarta');
    await p.click('.tarjeta-prenda[data-grupo="Buzo Etanol Gris"]');
    await p.click('.capa .talla-mas[data-talla="S"]'); await p.click('.capa .talla-mas[data-talla="M"]');
    a.ok(await p.isVisible('.capa'));
    await p.click('#tallas-agregar');
    await p.waitForSelector('.capa', { state: 'detached' });
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.carrito.lineas.length), 2);
  }],
  ['Tallas: tocar suma, "−" resta; al dar Listo la tarjeta queda marcada con la cantidad', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', caja: true, ruta: '/vender' });
    const g = '.tarjeta-prenda[data-grupo="Buzo Etanol Gris"]';
    await p.click(g);
    await p.click('.capa .talla-mas[data-talla="S"]'); await p.click('.capa .talla-mas[data-talla="S"]'); await p.click('.capa .talla-mas[data-talla="M"]');
    a.strictEqual(await p.innerText('.capa .talla-fila-v[data-sku="B-S"] .tf-cant'), '2');
    await p.click('.capa .talla-menos[data-sku="B-S"]');
    a.strictEqual(await p.innerText('.capa .talla-fila-v[data-sku="B-S"] .tf-cant'), '1');
    await p.click('.capa .talla-menos[data-sku="B-S"]');
    a.strictEqual(await p.innerText('.capa .talla-fila-v[data-sku="B-S"] .tf-cant'), '0');
    a.strictEqual(await p.$eval('.capa .talla-menos[data-sku="B-S"]', b => b.disabled), true, 'sin prendas el − no actúa');
    await p.click('.capa .talla-mas[data-talla="S"]');
    await p.click('#tallas-agregar');
    a.ok(await p.$(g + '.elegida'));
    a.strictEqual(await p.innerText(g + ' .en-carrito'), '2');
    a.strictEqual(await p.$('.tarjeta-prenda.elegida:not([data-grupo="Buzo Etanol Gris"])'), null);
  }],
  ['Tallas: − y + de 48 px, separados y sin encimarse con otra talla', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.click('.tarjeta-prenda[data-grupo="Buzo Etanol Gris"]');
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
    await p.click('.tarjeta-prenda[data-grupo="Buzo Etanol Gris"]');
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
]);
