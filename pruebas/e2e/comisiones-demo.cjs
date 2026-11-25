// Incidencia #8: una venta a 22.000 genera 4.000 de comisión con la caja abierta.
const { casos, entrarComo } = require('./_servidor.cjs');
const SKU = 'F-B-4';

async function usarPrecioDeLaIncidencia(p) {
  // La semilla de las pruebas trae este SKU a 25.000.
  const resultado = await p.evaluate(sku => {
    const { almacen, productos } = window.__pos.ctx;
    const precios = [22000, ...productos[sku].precios.slice(1)];
    return almacen.aplicarImportacion({ cambios: [{ sku, campos: { precios } }] });
  }, SKU);
  if (!resultado.ok) throw new Error('No se pudo preparar el precio de demostración');
}

async function vender(p) {
  await p.evaluate(async sku => {
    const { ctx } = window.__pos;
    await ctx.almacen.abrirCaja({});
    ctx.carrito = { lineas: [{ sku, cantidad: 1 }], cliente: { nombre: 'Ana Pérez', telefono: '584121234567' } };
    window.dispatchEvent(new Event('pos:carrito'));
  }, SKU);
  await p.evaluate(() => { location.hash = '/vender'; });
  await p.click('[data-cobro] .cobrar');
  await p.click('.forma[data-forma="efectivo-cop"]');
  await p.click('#cobrar-final');
  await p.waitForSelector('text=Venta exitosa');
  const venta = await p.evaluate(() => [...window.__pos.ctx.almacen._estado('ventas').values()][0]);
  await p.click('text=Nueva venta');
  await p.evaluate(() => { location.hash = '/inicio'; });
  await p.waitForSelector('.tile[data-k="comision"]:has-text("4.000")');
  return venta;
}

async function irAComisiones(p) {
  await p.click('.side [data-ruta="/comisiones"]');
  await p.waitForSelector('#com-pendiente');
}

casos('comisiones-demo', [
  ['Modo demo persistente: Admin consulta la misma venta sin cerrar la caja', async (env, a) => {
    const p = await env.pagina({ ruta: '/ajustes' });
    await usarPrecioDeLaIncidencia(p);
    await p.click('#modo-demo');
    await p.click('.demo-roles [data-rol="vendedora"]');
    await p.waitForSelector('#aviso-demo:not([hidden])');
    const venta = await vender(p);
    a.strictEqual(venta.total, 22000);
    a.strictEqual(venta.lineas[0].comision, 4000);
    await p.click('#salir-demo');
    await p.waitForFunction(() => window.__pos.ctx.sesion.usuario === 'admin');
    await irAComisiones(p);
    a.strictEqual(await p.textContent('#com-pendiente'), '4.000', `la venta de @${venta.usuario} debe verse en Admin`);
    a.strictEqual(venta.usuario, 'vendedora');
    a.strictEqual(venta.uid, 'u-vendedora');
    const datos = await p.evaluate(({ id, cajaId, sku }) => {
      const { almacen } = window.__pos.ctx;
      return { venta: almacen._estado('ventas').get(id), caja: almacen._estado('cajas').get(cajaId)?.estado,
        existencia: almacen._estado('productos').get(sku).existencia };
    }, { id: venta.id, cajaId: venta.cajaId, sku: SKU });
    a.deepStrictEqual(datos, { venta, caja: 'abierta', existencia: 11 });
    await p.click('#com-pagar');
    await p.waitForFunction(() => document.querySelector('.resumen-com')?.textContent.includes('Todo pagado'));
    a.deepStrictEqual(await p.evaluate(() => [...window.__pos.ctx.almacen._estado('comisiones').values()].map(x => [x.vendedor, x.monto, x.ventas])),
      [['vendedora', 4000, [venta.id]]]);
    await p.waitForFunction(id => JSON.parse(localStorage.getItem('pos-demo-datos'))?.col.comisiones
      .some(([, pago]) => pago.ventas.includes(id)), venta.id);
    await p.reload();
    await p.waitForFunction(() => document.querySelector('.resumen-com')?.textContent.includes('Todo pagado'));
    a.strictEqual(await p.locator('#com-pagar').count(), 0);
  }],
  ['Roles con PIN: la vendedora y Admin ven 4.000 con la caja de la venta abierta', async (env, a) => {
    const p = await env.pagina({ query: '?demo&entrar' });
    await usarPrecioDeLaIncidencia(p);
    await p.evaluate(() => window.__pos.ctx.almacen.salir());
    await entrarComo(p, 'vendedora');
    const venta = await vender(p);
    a.strictEqual(venta.usuario, 'vendedora');
    a.strictEqual(venta.total, 22000);
    await p.evaluate(() => window.__pos.ctx.almacen.salir());
    await entrarComo(p, 'admin');
    await irAComisiones(p);
    a.strictEqual(await p.textContent('#com-pendiente'), '4.000');
    a.strictEqual(await p.evaluate(id => window.__pos.ctx.almacen._estado('cajas').get(id).estado, venta.cajaId), 'abierta');
  }],
  ['Una venta histórica @demo se liquida por separado y conserva su atribución', async (env, a) => {
    const p = await env.pagina({ ruta: '/inicio' });
    await p.waitForFunction(() => localStorage.getItem('pos-demo-datos'));
    // Si se escribe en la página anterior, un guardado pendiente de la demo puede reemplazar la semilla.
    await p.addInitScript(() => {
      const clave = 'pos-demo-datos';
      const datos = JSON.parse(localStorage.getItem(clave));
      const fecha = new Date().toISOString();
      const ventas = [
        { id: 'historica', usuario: 'demo', uid: 'u-demo', comision: 4000 },
        { id: 'otro-uid', usuario: 'demo', uid: 'otro', comision: 12000 },
        { id: 'normal', usuario: 'vendedora', uid: 'u-vendedora', comision: 3000 },
      ];
      datos.col.ventas = ventas.map(({ id, usuario, uid, comision }) => [id, { id, usuario, uid, estado: 'ok', fecha,
        lineas: [{ sku: 'F-B-4', cantidad: 1, comision }], total: 22000 }]);
      localStorage.setItem(clave, JSON.stringify(datos));
    });
    await p.reload();
    await p.waitForSelector('#app[data-listo="1"]');
    await irAComisiones(p);
    a.strictEqual(await p.textContent('#com-pendiente'), '3.000');
    await p.click('#com-vendedor [data-usuario="demo"]');
    a.strictEqual(await p.textContent('#com-pendiente'), '4.000');
    await p.click('#com-pagar');
    await p.waitForFunction(() => document.querySelector('.resumen-com')?.textContent.includes('Todo pagado'));
    a.strictEqual(await p.locator('#com-pagar').count(), 0);
    a.deepStrictEqual(await p.evaluate(() => {
      const { almacen } = window.__pos.ctx;
      const v = almacen._estado('ventas').get('historica');
      const [pago] = [...almacen._estado('comisiones').values()];
      return { usuario: v.usuario, uid: v.uid, pago: [pago.vendedor, pago.monto, pago.ventas] };
    }), { usuario: 'demo', uid: 'u-demo', pago: ['demo', 4000, ['historica']] });
    await p.click('#com-vendedor [data-usuario="vendedora"]');
    a.strictEqual(await p.textContent('#com-pendiente'), '3.000');
    a.strictEqual(await p.locator('#com-pagar').count(), 1);
  }],
]);
