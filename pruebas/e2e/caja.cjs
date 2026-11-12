// Tarea 14: abrir con fondo, movimientos, esperado por forma de pago, cierre con diferencias, reabrir solo admin.
const { casos, entrarComo } = require('./_servidor.cjs');
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());

async function abrirConFondo(p) {
  await p.fill('#fondo-cop', '50.000'); await p.fill('#fondo-usd', '20'); await p.fill('#fondo-bs', '500');
  await p.click('#abrir-caja');
  await p.waitForSelector('.esperado[data-forma="efectivo-cop"]');
}
async function ventaDemo(p) {
  await p.evaluate(async () => {
    const a = window.__pos.ctx.almacen;
    await a.guardarVenta({ id: a.nuevoId(), fecha: new Date().toISOString(), cliente: { nombre: 'Ana', telefono: '584121234567' },
      lineas: [{ sku: 'J-M', nombre: 'Jogger', cantidad: 1, precioUnit: 116000, subtotal: 116000, tramo: 0, comision: 4000, reducida: false }],
      subtotal: 116000, descuento: null, total: 116000,
      pagos: [{ forma: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP', monto: 120000, equivalenteCop: 120000 }],
      vuelto: { moneda: 'COP', monto: 4000, forma: 'efectivo-cop', equivalenteCop: 4000 }, tasas: { copPorUsd: 3900, bsPorUsd: 1075 } });
  });
}

casos('caja', [
  ['Abrir, salida de 10.000 y una venta: esperado 156.000 en efectivo pesos', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', ruta: '/caja' });
    await abrirConFondo(p);
    await p.click('button:has-text("Entrada o salida")');
    await p.click('#mov-tipo-salida');
    await p.selectOption('#mov-forma', 'efectivo-cop');
    await p.fill('#mov-monto', '10.000'); await p.fill('#mov-motivo', 'gasto');
    await p.click('#mov-final');
    await ventaDemo(p);
    await p.waitForFunction(() => document.querySelector('.esperado[data-forma="efectivo-cop"] .monto')?.textContent.includes('156.000'));
    a.ok((await texto(p, '.esperado[data-forma="efectivo-usd"] .monto')).includes('20,00'));
    a.ok((await texto(p, '.movimientos')).includes('gasto'));
  }],
  ['Cierre: 1.500 de faltante es ámbar y pide nota; 6.000 es rojo', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', ruta: '/caja' });
    await abrirConFondo(p);
    await ventaDemo(p);
    await p.click('button:has-text("Cerrar caja")');
    await p.fill('#contado-efectivo-cop', '164.500');
    a.ok(await p.$('.fila-cierre[data-forma="efectivo-cop"].leve'));
    await p.fill('#contado-efectivo-usd', '20'); await p.fill('#contado-efectivo-bs', '500');
    await p.click('#cierre-final');
    await p.waitForSelector('text=Escribe una nota sobre la diferencia');
    await p.fill('#contado-efectivo-cop', '160.000');
    a.ok(await p.$('.fila-cierre[data-forma="efectivo-cop"].grave'));
    await p.fill('#cierre-nota', 'Faltó vuelto');
    await p.click('#cierre-final');
    await p.waitForSelector('text=Caja cerrada');
    a.strictEqual(await p.$('button:has-text("Entrada o salida")'), null);
    a.strictEqual(await p.$('button:has-text("Reabrir")'), null);
  }],
  ['Solo el administrador ve Reabrir', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', ruta: '/caja' });
    await abrirConFondo(p);
    await p.click('button:has-text("Cerrar caja")');
    await p.fill('#contado-efectivo-cop', '50.000'); await p.fill('#contado-efectivo-usd', '20'); await p.fill('#contado-efectivo-bs', '500');
    await p.click('#cierre-final');
    await p.waitForSelector('text=Caja cerrada');
    await p.click('.side [aria-label="Mi cuenta"]'); await p.click('text=Cerrar sesión');
    await entrarComo(p, 'admin');
    await p.evaluate(() => { location.hash = '/caja'; });
    await p.click('button:has-text("Reabrir")');
    await p.waitForFunction(() => !document.querySelector('.caja-cerrada button'));
    const abierta = await p.evaluate(() => [...window.__pos.ctx.almacen._estado('cajas').values()][0].estado);
    a.strictEqual(abierta, 'abierta');
    a.deepStrictEqual(p.errores, []);
  }],
]);
