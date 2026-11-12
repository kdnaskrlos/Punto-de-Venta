// Tarea 11: pastilla de tasas, detalle, calculadora y tasa de Bs ausente.
const { casos } = require('./_servidor.cjs');
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());

casos('calculadora', [
  ['La pastilla muestra $ 3.900 · Bs 1.075 y el detalle', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora' });
    a.strictEqual(await texto(p, '.topbar .tasas'), '$ 3.900 · Bs 1.075');
    await p.click('.topbar .tasas');
    const d = await texto(p, '.capa');
    for (const t of ['3.900', '1.075', 'Manual', 'Último cambio', '1 Bs = 3,63 COP']) a.ok(d.includes(t), `falta ${t} en ${d}`);
  }],
  ['PC: panel derecho sin tapar el carrito; 100 USD = 390.000 COP = 107.500,00 Bs', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.click('.topbar [aria-label="Calculadora"]');
    a.ok(await p.$('.capa.hoja.derecha'));
    await p.waitForTimeout(350); // fin de la animación de entrada
    const calc = await p.$eval('.capa .caja', e => e.getBoundingClientRect().toJSON());
    const carro = await p.$eval('.lado-carrito', e => e.getBoundingClientRect().toJSON());
    a.ok(calc.right <= carro.left + 1, `la calculadora (${calc.left}-${calc.right}) tapa el carrito (${carro.left}-${carro.right})`);
    await p.click('.lado-carrito .sec-t, .lado-carrito .nota'); // el carrito sigue usable con la calculadora abierta
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
    a.strictEqual(await texto(p, '.topbar .tasas'), '$ 3.900 · Bs —');
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
]);
