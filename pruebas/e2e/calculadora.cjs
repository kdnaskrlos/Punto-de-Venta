// Tarea 11: pastilla de tasas, detalle, calculadora y tasa de Bs ausente.
const { casos } = require('./_servidor.cjs');
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());

casos('calculadora', [
  ['La pastilla muestra $ 3.900 / Bs 1.075 y el detalle', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora' });
    // v2.15: en la PC, dos pastillas: Peso y Bs (con su fuente)
    a.deepStrictEqual(await p.$$eval('.topbar .tasas', b => b.map(x => x.textContent.replace(/\s+/g, ' ').trim())), ['COP3.900', 'Bs1.075']);
    // v2.18: las pastillas solo informan: tocarlas no abre nada.
    await p.click('.topbar .tasas'); await p.waitForTimeout(300);
    a.strictEqual(await p.$('.capa'), null);
  }],
  ['PC: panel derecho sin tapar la barra de cobro; 100 USD = 390.000 COP = 107.500,00 Bs', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'J-M', cantidad: 1 }], descuento: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    await p.click('.topbar [aria-label="Calculadora"]');
    a.ok(await p.$('.capa.hoja.derecha'));
    await p.waitForTimeout(350); // fin de la animación de entrada
    const calc = await p.$eval('.capa .caja', e => e.getBoundingClientRect().toJSON());
    // v2.15: en la PC la calculadora termina encima de la barra de cobro (no tapa Cobrar)
    const pie = await p.$eval('.pie-pc', e => e.getBoundingClientRect().toJSON());
    a.ok(calc.bottom <= pie.top + 1, `la calculadora (hasta ${calc.bottom}) tapa la barra de cobro (desde ${pie.top})`);
    await p.click('.zona-carrito .linea b'); // el carrito sigue usable con la calculadora abierta
    a.ok(await p.$('.capa .caja'));
    await p.fill('#calc-usd', '100');
    a.strictEqual(await p.inputValue('#calc-cop'), '390.000');
    a.strictEqual(await p.inputValue('#calc-bs'), '107.500,00');
    await p.fill('#calc-cop', '66.000');
    a.strictEqual(await p.inputValue('#calc-bs'), '18.192,31');
    a.strictEqual(await p.inputValue('#calc-usd'), '16,92');
  }],
  ['Teléfono: hoja inferior', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora' });
    await p.click('.topbar [aria-label="Calculadora"]');
    a.ok(await p.$('.capa.hoja.abajo'));
  }],
  ['Sin tasa de Bs: "Sin tasa", nunca NaN', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin' });
    await p.evaluate(() => window.__pos.ctx.almacen.guardarAjustes('tasas', { bsModo: 'binance' }));
    await p.waitForFunction(() => window.__pos.ctx.tasas.bsPorUsd === null);
    a.strictEqual(await p.$$eval('.topbar .tasas', b => b[1].textContent.replace(/\s+/g, ' ').trim()), 'Bs—');
    await p.click('.topbar [aria-label="Calculadora"]');
    await p.fill('#calc-usd', '10');
    a.strictEqual(await p.inputValue('#calc-bs'), '');
    a.strictEqual(await p.getAttribute('#calc-bs', 'placeholder'), 'Sin tasa');
    a.ok(!(await p.innerText('body')).includes('NaN'));
  }],
  ['Copiar un monto', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora' });
    await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await p.click('.topbar [aria-label="Calculadora"]');
    await p.fill('#calc-usd', '2');
    await p.click('[aria-label="Copiar pesos"]');
    a.strictEqual(await p.evaluate(() => navigator.clipboard.readText()), '7.800');
  }],
  ['Teléfono: tasa junto a cada moneda, prefijo en la caja y sin descripción al pie', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780 });
    await p.click('.topbar [aria-label="Calculadora"]');
    a.strictEqual(await p.$('.calc-pie'), null);
    a.deepStrictEqual(await p.$$eval('.calc-pre', e => e.map(x => x.textContent)), ['COP', '$', 'Bs.']);
    a.match(await p.innerText('.calc-fila:first-child .calc-tasa'), /^Tasa: /);
    a.strictEqual(await p.$$eval('.calc-fila', f => f.every(x => x.scrollWidth <= x.clientWidth)), true);
  }],
  ['v2.18 · PC: la tuerca de la calculadora abre Ajustes › Tasas', async (env, a) => {
    const p = await env.pagina({ ruta: '/inicio' });
    await p.click('.topbar [aria-label="Calculadora"]');
    await p.click('#calc-ajustes'); await p.waitForTimeout(500);
    a.strictEqual(await p.evaluate(() => location.hash), '#/ajustes');
    a.strictEqual(await p.getAttribute('#aj-tab-tasas', 'aria-selected'), 'true');
    a.strictEqual(await p.$('.calc2'), null);
  }],
  ['v2.21 · Teléfono: la tuerca de la calculadora también abre Ajustes › Tasas', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 844, ruta: '/inicio' });
    await p.click('.topbar [aria-label="Calculadora"]');
    await p.click('#calc-ajustes'); await p.waitForTimeout(600);
    a.strictEqual(await p.evaluate(() => location.hash), '#/ajustes');
    a.strictEqual(await p.getAttribute('#aj-tab-tasas', 'aria-selected'), 'true');
  }],
  ['Calculadora: sin "0" de ejemplo, borrador arriba limpia todo y Enter oculta el teclado', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780 });
    await p.click('.topbar [aria-label="Calculadora"]');
    a.strictEqual(await p.getAttribute('#calc-usd', 'placeholder'), '');
    await p.fill('#calc-usd', '10');
    await p.press('#calc-usd', 'Enter');
    a.strictEqual(await p.evaluate(() => document.activeElement?.tagName), 'BODY');
    a.notStrictEqual(await p.inputValue('#calc-cop'), '');
    await p.click('.capa .cab #calc-borrar');
    a.deepStrictEqual(await p.$$eval('.calc input', i => i.map(x => x.value)), ['', '', '']);
  }],
]);
