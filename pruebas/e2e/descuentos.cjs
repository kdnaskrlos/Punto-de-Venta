// Incidencia #10: la autorización debe seguir al borrador de la vendedora.
const { casos, cambiarA } = require('./_servidor.cjs');

async function preparar(env, { conCarrito = true } = {}) {
  const p = await env.pagina({ ruta: '/ajustes' });
  const datos = await p.evaluate(() => {
    const { almacen, productos } = window.__pos.ctx;
    return almacen.aplicarImportacion({ cambios: ['B-S', 'J-M'].map(sku => ({
      sku, campos: { precios: [65000, ...productos[sku].precios.slice(1)] },
    })) });
  });
  if (!datos.ok) throw Error('No se pudo preparar el precio de prueba');
  await p.click('#modo-demo');
  await p.click('.demo-roles [data-rol="vendedora"]');
  await p.waitForFunction(() => window.__pos.ctx.sesion?.usuario === 'vendedora');
  if (conCarrito) await crearCarrito(p);
  return p;
}

async function crearCarrito(p, sku = 'B-S') {
  await p.evaluate(sku => {
    window.__pos.ctx.carrito = {
      lineas: [{ sku, cantidad: 1 }],
      cliente: { nombre: 'Cliente sintético', telefono: '584121234567' },
    };
    dispatchEvent(new CustomEvent('pos:carrito'));
    location.hash = '/vender';
  }, sku);
  await p.waitForSelector('.vista[data-ruta="/vender"] .total-cop:has-text("65.000")');
}

const dialogo = p => p.getByRole('dialog', { name: 'Descuento', exact: true });

async function abrirDescuento(p) {
  await p.click('[data-cobro] .cobrar');
  await p.click('#car-descuento');
}

async function pedir(p, monto = '2.000') {
  await abrirDescuento(p);
  await p.fill('#desc-valor', monto);
  await dialogo(p).getByRole('button', { name: 'Aplicar', exact: true }).click();
  await dialogo(p).getByText('Esperando autorización…', { exact: true }).waitFor();
}

async function salirDelCobro(p) {
  await dialogo(p).locator('.cerrar').click();
  await p.waitForSelector('.capa[aria-label="Descuento"]', { state: 'detached' });
  await p.keyboard.press('Escape');
  await p.waitForSelector('.capa[aria-label="Cobrar"]', { state: 'detached' });
}

const solicitudes = p => p.evaluate(() => [...window.__pos.ctx.almacen._estado('autorizaciones').values()]);
const carrito = p => p.evaluate(() => window.__pos.ctx.carrito);

async function responder(p, accion) {
  await p.evaluate(() => { location.hash = '/inicio'; });
  const tarjeta = p.locator('.autorizacion', { hasText: '@vendedora pide 2.000 COP' });
  await tarjeta.getByRole('button', { name: accion, exact: true }).click();
}

async function retomar(p) {
  await p.click('#retomar-si');
  await p.waitForSelector('.vista[data-ruta="/vender"]');
  await p.waitForSelector('#retomar-si', { state: 'detached' });
}

casos('descuentos', [
  ['La aprobación de 2.000 COP llega al carrito original al volver del perfil Administrador', async (env, a) => {
    const p = await preparar(env);
    await pedir(p);
    const [solicitud] = await solicitudes(p);
    const original = await carrito(p);
    await salirDelCobro(p);
    await p.click('#salir-demo');
    await p.waitForFunction(() => window.__pos.ctx.sesion?.usuario === 'admin');
    a.ok(await p.locator('#aviso-demo').isHidden());
    a.ok(!(await carrito(p))?.lineas?.length);
    a.strictEqual(await p.locator('#retomar-si').count(), 0);
    await responder(p, 'Aprobar');
    await cambiarA(p, 'vendedora');
    await p.locator('#aviso-demo').getByText('Modo demo · Vendedora', { exact: true }).waitFor();
    await retomar(p);
    await p.waitForSelector('.vista[data-ruta="/vender"] .total-cop:has-text("63.000")');
    const despues = await carrito(p);
    a.strictEqual(despues.ventaId, original.ventaId);
    a.strictEqual(despues.autorizacion.id, solicitud.id);
    a.strictEqual((await solicitudes(p)).length, 1);
    await p.evaluate(() => window.__pos.ctx.almacen.abrirCaja({}));
    await p.click('[data-cobro] .cobrar');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Venta exitosa');
    const ventas = await p.evaluate(() => [...window.__pos.ctx.almacen._estado('ventas').values()]);
    a.deepStrictEqual(ventas.map(v => [v.id, v.usuario, v.total, v.descuento.monto, v.descuento.autorizadoPor]),
      [[original.ventaId, 'vendedora', 63000, 2000, 'admin']]);
    a.strictEqual(await p.evaluate(() => localStorage.getItem('pos-venta-vendedora')), null);
  }],
  ['Al recargar una solicitud pendiente, se puede revisar y rechazar sin duplicarla', async (env, a) => {
    const p = await preparar(env);
    await pedir(p);
    const [primera] = await solicitudes(p);
    a.deepStrictEqual(await p.evaluate(id => window.__pos.ctx.almacen.responderAutorizacion(id, true), primera.id),
      { ok: false, error: 'permiso' });
    const original = await carrito(p);
    await p.reload();
    await retomar(p);
    await abrirDescuento(p);
    a.strictEqual(await dialogo(p).getByText('Esperando autorización…').isDisabled(), true);
    a.strictEqual((await solicitudes(p)).length, 1);
    await salirDelCobro(p);
    await cambiarA(p, 'admin');
    await responder(p, 'Rechazar');
    await cambiarA(p, 'vendedora');
    await retomar(p);
    await p.waitForSelector('.vista[data-ruta="/vender"] .total-cop:has-text("65.000")');
    const rechazado = await carrito(p);
    a.strictEqual(rechazado.ventaId, original.ventaId);
    a.strictEqual(rechazado.autorizacion, null);
    a.strictEqual(rechazado.descuento, null);
    a.strictEqual((await solicitudes(p))[0].estado, 'rechazada');
    await abrirDescuento(p);
    await dialogo(p).getByText('Descuento rechazado', { exact: true }).waitFor();
    await dialogo(p).getByRole('button', { name: 'Aplicar', exact: true }).click();
    await dialogo(p).getByText('Esperando autorización…', { exact: true }).waitFor();
    const lista = await solicitudes(p);
    a.strictEqual(lista.length, 2);
    a.strictEqual(lista[0].id, primera.id);
    a.notStrictEqual(lista[1].id, primera.id);
  }],
  ['La aprobación llega con Vendedora y Administrador en pestañas simultáneas y persiste al recargar', async (env, a) => {
    const p = await preparar(env, { conCarrito: false });
    const admin = await p.context().newPage();
    await admin.goto(p.url().replace(/#.*$/, '#/inicio'));
    await admin.waitForSelector('#app[data-listo="1"]');
    await cambiarA(admin, 'admin');
    a.ok(!(await carrito(admin))?.lineas?.length);
    a.strictEqual(await admin.locator('#retomar-si').count(), 0);
    await crearCarrito(p);
    await pedir(p);
    const [solicitud] = await solicitudes(p);
    const original = await carrito(p);
    await salirDelCobro(p);
    await responder(admin, 'Aprobar');
    await p.waitForSelector('.vista[data-ruta="/vender"] .total-cop:has-text("63.000")');
    await cambiarA(p, 'encargada');
    a.strictEqual(await p.locator('.autorizacion').count(), 0);
    a.ok(!(await carrito(p))?.lineas?.length);
    await cambiarA(p, 'vendedora');
    await p.reload();
    await retomar(p);
    await p.waitForSelector('.vista[data-ruta="/vender"] .total-cop:has-text("63.000")');
    a.strictEqual((await carrito(p)).ventaId, original.ventaId);
    a.strictEqual((await carrito(p)).autorizacion.id, solicitud.id);
    a.strictEqual((await solicitudes(p)).length, 1);
  }],
  ['Un cambio de prendas con el mismo subtotal invalida una solicitud pendiente y no se reaplica al deshacer', async (env, a) => {
    const p = await preparar(env);
    await pedir(p);
    const seleccionado = await carrito(p);
    await salirDelCobro(p);
    await cambiarPrenda(p, 'J-M');
    await cambiarPrenda(p, 'B-S');
    await cambiarA(p, 'admin');
    await responder(p, 'Aprobar');
    await cambiarA(p, 'vendedora');
    await retomar(p);
    await p.waitForSelector('.vista[data-ruta="/vender"] .total-cop:has-text("65.000")');
    const actual = await carrito(p);
    a.strictEqual(actual.ventaId, seleccionado.ventaId);
    a.strictEqual(actual.autorizacion, null);
    a.strictEqual(actual.descuento, null);
    a.strictEqual((await solicitudes(p)).length, 1);
    await abrirDescuento(p);
    await dialogo(p).getByText('El carrito cambió. Vuelve a pedir autorización.', { exact: true }).waitFor();
    a.strictEqual(await dialogo(p).getByRole('button', { name: 'Aplicar', exact: true }).isEnabled(), true);
  }],
  ['Una aprobación aplicada se invalida si cambia el carrito y no pasa a otra venta', async (env, a) => {
    const p = await preparar(env);
    await pedir(p);
    const [solicitud] = await solicitudes(p);
    const original = await carrito(p);
    await salirDelCobro(p);
    await cambiarA(p, 'admin');
    await responder(p, 'Aprobar');
    await cambiarA(p, 'vendedora');
    await retomar(p);
    await p.waitForSelector('.vista[data-ruta="/vender"] .total-cop:has-text("63.000")');
    await cambiarPrenda(p, 'J-M');
    await p.waitForSelector('.vista[data-ruta="/vender"] .total-cop:has-text("65.000")');
    a.strictEqual((await carrito(p)).autorizacion, null);
    await p.evaluate(async () => {
      const { vaciarCarrito } = await import('/js/vistas/vender.js');
      vaciarCarrito(window.__pos.ctx);
    });
    await crearCarrito(p);
    await abrirDescuento(p);
    const nuevo = await carrito(p);
    a.notStrictEqual(nuevo.ventaId, original.ventaId);
    a.strictEqual(nuevo.autorizacion ?? null, null);
    a.strictEqual(nuevo.solicitudDescuento, undefined);
    a.strictEqual((await solicitudes(p))[0].id, solicitud.id);
  }],
]);

async function cambiarPrenda(p, sku) {
  await p.evaluate(sku => {
    window.__pos.ctx.carrito.lineas = [{ sku, cantidad: 1 }];
    dispatchEvent(new CustomEvent('pos:carrito'));
  }, sku);
}
