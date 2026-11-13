// Tarea 14: abrir con fondo, movimientos, esperado por forma de pago, cierre con diferencias, reabrir solo admin.
const { casos, entrarComo } = require('./_servidor.cjs');
const { cambiarA } = require('./_servidor.cjs');
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());

async function abrirConFondo(p) {
  await p.fill('#fondo-cop', '50.000'); await p.fill('#fondo-usd', '20');
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
    await p.fill('#contado-efectivo-usd', '20');
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
    await p.fill('#contado-efectivo-cop', '50.000'); await p.fill('#contado-efectivo-usd', '20');
    await p.click('#cierre-final');
    await p.waitForSelector('text=Caja cerrada');
    await cambiarA(p, 'admin');
    await p.evaluate(() => { location.hash = '/caja'; });
    await p.click('button:has-text("Reabrir")');
    await p.waitForFunction(() => !document.querySelector('.caja-cerrada button'));
    const abierta = await p.evaluate(() => [...window.__pos.ctx.almacen._estado('cajas').values()][0].estado);
    a.strictEqual(abierta, 'abierta');
    a.deepStrictEqual(p.errores, []);
  }],
  ['"Cerrar caja" es un botón secundario (no el verde principal)', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/caja' });
    const clases = await p.$eval('.vista button:has-text("Cerrar caja")', b => b.className);
    a.ok(!/\bprimary\b/.test(clases), clases);
  }],
  ['Vendedora sin caja: tocar una prenda abre "Abrir caja" y no la agrega', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', ruta: '/vender' });
    await p.click('.tarjeta-prenda[data-grupo="Buzo Etanol Gris"]');
    await p.waitForSelector('.capa #fondo-cop');
    a.strictEqual(await p.evaluate(() => (window.__pos.ctx.carrito?.lineas || []).length), 0);
  }],
  ['Dueños: venden sin abrir caja; se crea sola su caja personal, sin fondo', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'encargada', ruta: '/vender' });
    a.strictEqual(await p.isVisible('.sin-caja'), false);
    await p.click('.tarjeta-prenda[data-grupo="Buzo Etanol Gris"]');
    await p.click('.capa .talla-mas[data-talla="S"]'); await p.click('#tallas-agregar');
    await p.click('.barra-carrito'); await p.click('.capa .cobrar');
    await p.fill('#cli-tel', '0414-555.12.12'); await p.fill('#cli-nombre', 'Luis'); await p.click('#cli-guardar');
    await p.click('.forma[data-forma="pago-movil"]');
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Venta exitosa');
    const c = await p.evaluate(() => [...window.__pos.ctx.almacen._estado('cajas').values()].map(x => ({ tipo: x.tipo, fondo: x.fondo, usuario: x.usuario })));
    a.deepStrictEqual(c, [{ tipo: 'personal', fondo: { COP: 0, USD: 0, BS: 0 }, usuario: 'encargada' }]);
  }],
  ['Dueños: Caja muestra "Cobrado por mí hoy", sin fondo ni cierre', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/caja' });
    const t = await p.innerText('.vista');
    a.match(t, /Cobrado por mí hoy/i);
    a.strictEqual(!!(await p.$('#fondo-cop')), false, 'no pide fondo');
    a.strictEqual(!!(await p.$('.vista button:has-text("Cerrar caja")')), false, 'no ofrece cerrar');
  }],
  ['Medianoche: la caja de ayer se cierra sola, el admin ve el aviso y la vendedora arquea con un solo conteo', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true });
    await p.evaluate(async () => {
      const ctx = window.__pos.ctx; const c = [...ctx.almacen._estado('cajas').values()][0];
      const d = new Date(Date.now() - 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
      c.abierta = new Date(`${d}T08:00:00-04:00`).toISOString();
      await ctx.revisarCajas();
    });
    await p.waitForFunction(() => !window.__pos.ctx.miCaja);
    await cambiarA(p, 'admin');
    await p.evaluate(() => { location.hash = '/inicio'; });
    await p.waitForSelector('.aviso:has-text("se cerró sola")');
    await cambiarA(p, 'vendedora');
    await p.evaluate(() => { location.hash = '/vender'; });
    await p.click('.sin-caja button:has-text("Abrir caja")');
    await p.waitForSelector('.capa:has-text("se cerró sola")');
    await p.fill('#contado-efectivo-cop', '50.000'); await p.fill('#contado-efectivo-usd', '20');
    await p.click('#arqueo-final');
    await p.waitForSelector('.capa', { state: 'detached' });
    const r = await p.evaluate(() => { const cs = [...window.__pos.ctx.almacen._estado('cajas').values()]; return { vieja: cs[0].cierre.porArquear, nueva: cs[1]?.fondo, abierta: cs[1]?.estado }; });
    a.deepStrictEqual(r, { vieja: false, nueva: { COP: 50000, USD: 20, BS: 0 }, abierta: 'abierta' });
  }],
]);
