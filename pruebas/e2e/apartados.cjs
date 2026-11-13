// Tarea 13: apartar con abono, abonar, completar (sin volver a descontar) y cancelar (solo gestión).
const { casos, entrarComo } = require('./_servidor.cjs');
const { cambiarA } = require('./_servidor.cjs');
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());
const existencia = (p, sku) => p.evaluate(s => window.__pos.ctx.productos[s].existencia, sku);

async function apartar(p, abono) {
  await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'J-L', cantidad: 2 }], descuento: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
  await p.click('.lado-carrito button:has-text("Apartar")');
  await p.fill('#cli-tel', '0412-123.45.67');
  await p.click('#cli-guardar');
  if (abono != null) {
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.fill('.pago[data-forma="efectivo-cop"] input', abono);
  }
  await p.click('#apartar-final');
  await p.waitForSelector('text=Apartado creado');
}

casos('apartados', [
  ['Apartar con abono 0 reserva las unidades y queda pendiente', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await apartar(p, null);
    a.strictEqual(await existencia(p, 'J-L'), 3);
    a.strictEqual(await p.$('.lado-carrito .linea'), null);
    await p.click('.side .nav[aria-label="Apartados"]'); await p.waitForSelector('.apartado');
    const t = await texto(p, '.apartado');
    for (const x of ['Ana Pérez', '84.000', '2 prendas', 'Abonado 0']) a.ok(t.includes(x), `falta ${x} en ${t}`);
    await p.click('.apartado');
    const d = await texto(p, '.ap-det');
    for (const x of ['Pendiente', 'Saldo pendiente', '84.000', 'Prendas']) a.ok(d.includes(x), `falta ${x} en el detalle: ${d}`);
  }],
  ['Abonar suma y Completar crea la venta sin volver a descontar', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await apartar(p, '20.000');
    await p.click('.side .nav[aria-label="Apartados"]'); await p.waitForSelector('.apartado');
    a.ok((await texto(p, '.apartado')).includes('64.000'));
    await p.click('.apartado'); await p.click('#ap-abonar');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.fill('.pago[data-forma="efectivo-cop"] input', '4.000');
    await p.click('#abono-final');
    await p.waitForFunction(() => document.querySelector('.apartado')?.textContent.includes('60.000'));
    await p.click('.apartado'); a.ok((await texto(p, '.ap-det')).includes('Último abono'), 'último abono');
    await p.click('#ap-completar');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.click('#completar-final');
    await p.waitForFunction(() => !document.querySelector('.apartado')); // sale de Pendientes
    await p.click('.filtro-ap button:has-text("Todos")');
    await p.waitForFunction(() => document.querySelector('.apartado .est')?.textContent === 'Completado');
    a.strictEqual(await existencia(p, 'J-L'), 3);
    const vs = await p.evaluate(() => [...window.__pos.ctx.almacen._estado('ventas').values()]);
    a.strictEqual(vs.length, 1);
    a.strictEqual(vs[0].total, 84000);
    a.deepStrictEqual(vs[0].pagos.map(x => x.monto), [60000]);
  }],
  ['La vendedora no cancela; la encargada sí y devuelve existencias', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await apartar(p, null);
    await p.click('.side .nav[aria-label="Apartados"]'); await p.waitForSelector('.apartado');
    await p.click('.apartado'); await p.waitForSelector('#ap-abonar');
    a.strictEqual(await p.$('#ap-cancelar'), null);
    await p.keyboard.press('Escape');
    await cambiarA(p, 'encargada');
    await p.click('.side .nav[aria-label="Apartados"]'); await p.waitForSelector('.apartado');
    await p.click('.apartado'); await p.click('#ap-cancelar');
    await p.fill('#motivo', 'El cliente no volvió');
    await p.click('#motivo-final');
    await p.waitForFunction(() => !document.querySelector('.apartado')); // sale de Pendientes
    await p.click('.filtro-ap button:has-text("Todos")');
    await p.waitForFunction(() => document.querySelector('.apartado .est')?.textContent === 'Cancelado');
    a.strictEqual(await existencia(p, 'J-L'), 5);
    a.deepStrictEqual(p.errores, []);
  }],
  ['Sin apartados explica cómo se crean', async (env, a) => {
    const p = await env.pagina({ ruta: '/apartados' });
    a.match(await p.innerText('.vista'), /desde el carrito con «Apartar»/);
  }],
]);
