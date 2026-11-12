// Tarea 16: Inicio por rol, autorizaciones, ganancia congelada, anular, comisiones, reportes y ajustes.
const { casos, entrarComo } = require('./_servidor.cjs');
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());

// Venta de 1 Jogger M a 116.000 en efectivo (costo del jogger: 17.000 → ganancia 99.000; comisión 4.000).
async function vender(p) {
  return p.evaluate(async () => {
    const a = window.__pos.ctx.almacen;
    const id = a.nuevoId();
    await a.guardarVenta({ id, fecha: new Date().toISOString(), cliente: { nombre: 'Ana', telefono: '584121234567' },
      lineas: [{ sku: 'J-M', nombre: 'Jogger Texcol Negro', talla: 'M', cantidad: 1, precioUnit: 116000, subtotal: 116000, tramo: 0, comision: 4000, reducida: false }],
      subtotal: 116000, descuento: null, total: 116000,
      pagos: [{ forma: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP', monto: 116000, equivalenteCop: 116000 }], vuelto: null, tasas: { copPorUsd: 3900, bsPorUsd: 1075 } });
    return id;
  });
}
async function cambiarA(p, usuario, pin) {
  await p.evaluate(() => window.__pos.ctx.almacen.salir());
  await entrarComo(p, usuario, pin);
}

casos('gestion', [
  ['Inicio admin: ventas de hoy y ganancia; la vendedora no ve ganancia', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true });
    await vender(p);
    a.strictEqual(await p.$('.tile[data-k="ganancia"]'), null);
    a.ok((await texto(p, '.tile[data-k="mis-ventas"]')).includes('116.000'));
    await cambiarA(p, 'admin');
    await p.waitForFunction(() => document.querySelector('.tile[data-k="ventas"] .val')?.textContent === '116.000');
    await p.waitForFunction(() => document.querySelector('.tile[data-k="ganancia"] .val')?.textContent === '99.000');
  }],
  ['Ganancia congelada: cambiar el costo después no la mueve', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', caja: true });
    await vender(p);
    await p.waitForFunction(() => document.querySelector('.tile[data-k="ganancia"] .val')?.textContent === '99.000');
    await p.evaluate(() => window.__pos.ctx.almacen.aplicarImportacion({ nuevos: [], cambios: [{ sku: 'J-M', campos: { costo: 30000 } }], iguales: [], faltantes: [] }));
    await p.evaluate(() => { location.hash = '/reportes'; });
    await p.waitForSelector('.tile[data-k="ganancia"]');
    a.strictEqual(await texto(p, '.tile[data-k="ganancia"] .val'), '99.000');
  }],
  ['Autorización: la pide la vendedora, la aprueba el admin; la encargada no la ve', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora' });
    await p.evaluate(() => window.__pos.ctx.almacen.solicitarAutorizacion({ pct: 10, tipo: 'pct', valor: 10, subtotal: 100000 }));
    await cambiarA(p, 'encargada');
    a.strictEqual(await p.$('.autorizacion'), null);
    await cambiarA(p, 'admin');
    await p.click('.autorizacion button:has-text("Aprobar")');
    await p.waitForFunction(() => [...window.__pos.ctx.almacen._estado('autorizaciones').values()][0].estado === 'aprobada');
  }],
  ['Alerta de existencia negativa', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin' });
    await p.evaluate(() => { const al = window.__pos.ctx.almacen; al._estado('productos').get('B-L').existencia = -1; al.ajustarExistencia('B-S', 1, 'Conteo'); });
    await p.waitForSelector('text=Existencia negativa');
    a.ok((await texto(p, '.alertas')).includes('Buzo Etanol Gris · Talla L'));
  }],
  ['Anular desde Inicio (encargada): existencia vuelve y la comisión no cuenta', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true });
    await vender(p);
    await cambiarA(p, 'encargada');
    await p.click('.venta-hoy button:has-text("Anular")');
    await p.fill('#motivo', 'Cliente devolvió');
    await p.click('#motivo-final');
    await p.waitForFunction(() => window.__pos.ctx.productos['J-M'].existencia === 5);
    await p.evaluate(() => { location.hash = '/comisiones'; });
    await p.selectOption('#com-vendedor', 'vendedora');
    a.ok((await texto(p, '.resumen-com')).includes('Total 0'));
  }],
  ['Comisiones: total y marcar como pagadas', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true });
    await vender(p);
    await cambiarA(p, 'encargada');
    await p.evaluate(() => { location.hash = '/comisiones'; });
    await p.selectOption('#com-vendedor', 'vendedora');
    a.ok((await texto(p, '.resumen-com')).includes('Pendiente 4.000'));
    await p.click('button:has-text("Marcar como pagadas")');
    await p.waitForFunction(() => document.querySelector('.resumen-com')?.textContent.replace(/\s+/g, ' ').includes('Pendiente 0'));
  }],
  ['Reportes: más vendidos y existencias bajas', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', caja: true });
    await vender(p);
    await p.evaluate(() => { location.hash = '/reportes'; });
    await p.waitForSelector('.mas-vendidos');
    a.ok((await texto(p, '.mas-vendidos')).includes('Jogger Texcol Negro'));
    a.ok((await texto(p, '.bajas')).includes('Buzo Etanol Gris'));
  }],
  ['Ninguna pantalla muestra "null" ni "undefined"', async (env, a) => {
    for (const usuario of ['vendedora', 'encargada', 'admin']) {
      const p = await env.pagina({ usuario, caja: true });
      for (const ruta of ['/inicio', '/vender', '/apartados', '/inventario', '/caja', '/reportes', '/comisiones', '/ajustes']) {
        await p.evaluate(r => { location.hash = r; }, ruta); await p.waitForTimeout(150);
        const t = await p.innerText('.vista');
        a.ok(!/\bnull\b|\bundefined\b/.test(t), `${usuario} ${ruta}: ${t.slice(0, 120)}`);
      }
      await p.context().close();
    }
  }],
  ['Ajustes: tasa COP, usuario nuevo con PIN y desactivarlo', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/ajustes' });
    await p.fill('#aj-cop', '4.000');
    await p.click('#aj-tasas-guardar');
    await p.waitForFunction(() => document.querySelector('.topbar .tasas').textContent.includes('4.000'));
    await p.fill('#nu-usuario', 'maria'); await p.fill('#nu-nombre', 'María'); await p.selectOption('#nu-rol', 'vendedora'); await p.fill('#nu-pin', '5555');
    await p.click('#nu-crear');
    await p.waitForSelector('.usuario[data-usuario="maria"]');
    await cambiarA(p, 'maria', '5555');
    a.ok(await p.$('.side .nav[aria-label="Vender"]'));
    await cambiarA(p, 'admin');
    await p.evaluate(() => { location.hash = '/ajustes'; });
    await p.click('.usuario[data-usuario="maria"] button:has-text("Desactivar")');
    await p.waitForSelector('.usuario[data-usuario="maria"] .est.n');
    await p.evaluate(() => window.__pos.ctx.almacen.salir());
    await p.fill('#entrar-usuario', 'maria'); await p.fill('#entrar-pin', '5555'); await p.click('#entrar-btn');
    await p.waitForSelector('text=Usuario desactivado');
    a.deepStrictEqual(p.errores, []);
  }],
]);
