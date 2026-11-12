// Tarea 12: cobrar con pagos mixtos, cliente obligatorio, vuelto, recibo, doble toque, sin tasa y sin conexión.
const { casos } = require('./_servidor.cjs');
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());

async function preparar(env, opciones = {}) {
  const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender', ...opciones });
  // Buzo S 48.000 + Jogger M 42.000 + 2 bodies (separados, 18.000) = 126.000 − 10.000 de descuento = 116.000
  await p.evaluate(() => {
    const c = window.__pos.ctx;
    c.carrito = { lineas: [{ sku: 'B-S', cantidad: 1 }, { sku: 'J-M', cantidad: 1 }, { sku: 'Y-6m', cantidad: 1 }, { sku: 'Y-3m', cantidad: 1 }], descuento: { tipo: 'monto', valor: 10000 }, autorizacion: null };
    window.dispatchEvent(new CustomEvent('pos:carrito'));
  });
  return p;
}
const existencia = (p, sku) => p.evaluate(s => window.__pos.ctx.productos[s].existencia, sku);
const ventas = p => p.evaluate(() => [...window.__pos.ctx.almacen._estado('ventas').values()]);

casos('cobrar', [
  ['Cobrar exige cliente; teléfono conocido completa el nombre', async (env, a) => {
    const p = await preparar(env, { ancho: 360, alto: 780 });
    await p.click('.barra-carrito'); await p.click('.capa .cobrar');
    a.ok(await p.$('.capa.ventana.completa'));
    a.strictEqual(await texto(p, '#cobrar-final'), 'Cobrar 116.000');
    a.strictEqual(await p.$eval('#cobrar-final', b => b.disabled), true);
    await p.fill('#cli-tel', '0412-123.45.67');
    a.strictEqual(await p.inputValue('#cli-nombre'), 'Ana Pérez');
  }],
  ['Pago mixto: efectivo pesos 50.000 + pago móvil sugerido = Falta 0', async (env, a) => {
    const p = await preparar(env);
    await p.click('.lado-carrito .cobrar');
    await p.fill('#cli-tel', '0412-123.45.67');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.fill('.pago[data-forma="efectivo-cop"] input', '50.000');
    await p.click('.forma[data-forma="pago-movil"]');
    a.strictEqual(await p.inputValue('.pago[data-forma="pago-movil"] input'), '18.192,31');
    a.strictEqual(await texto(p, '.barra-falta'), 'Falta 0');
    a.ok(await p.$('.barra-falta.ok'));
    const btn = await p.$$eval('.forma', bs => bs.map(b => b.getBoundingClientRect().height));
    for (const hgt of btn) a.ok(hgt >= 48, `forma de ${hgt}px`);
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Venta guardada');
    const href = await p.getAttribute('a.recibo', 'href');
    a.ok(href.startsWith('https://wa.me/584121234567?text='), href);
    a.strictEqual(await existencia(p, 'B-S'), 2);
    const [v] = await ventas(p);
    a.strictEqual(v.total, 116000);
    a.deepStrictEqual(v.pagos.map(x => [x.forma, x.monto]), [['efectivo-cop', 50000], ['pago-movil', 18192.31]]);
    a.strictEqual(v.descuento.monto, 10000);
    a.ok(v.lineas.every(l => l.reducida), 'descuento → comisión reducida');
    await p.click('text=Nueva venta');
    a.strictEqual(await p.$('.lado-carrito .linea'), null);
  }],
  ['Doble clic rápido en Cobrar: una sola venta', async (env, a) => {
    const p = await preparar(env);
    await p.click('.lado-carrito .cobrar');
    await p.fill('#cli-tel', '0412-123.45.67');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.dblclick('#cobrar-final');
    await p.waitForSelector('text=Venta guardada');
    a.strictEqual((await ventas(p)).length, 1);
    a.strictEqual(await existencia(p, 'J-M'), 4);
  }],
  ['Vuelto en Bs con 40 USD: 11.025,64', async (env, a) => {
    const p = await preparar(env);
    await p.click('.lado-carrito .cobrar');
    await p.click('.forma[data-forma="efectivo-usd"]');
    await p.fill('.pago[data-forma="efectivo-usd"] input', '40');
    a.ok((await texto(p, '.barra-falta')).startsWith('Vuelto'));
    await p.click('.vuelto-moneda [data-moneda="BS"]');
    a.strictEqual(await texto(p, '.barra-falta .monto'), '11.025,64 Bs');
  }],
  ['Sin tasa de Bs: botones de bolívares desactivados', async (env, a) => {
    const p = await preparar(env);
    await p.evaluate(() => { const c = window.__pos.ctx; c.tasas = { ...c.tasas, bsPorUsd: null }; });
    await p.click('.lado-carrito .cobrar');
    a.strictEqual(await p.$eval('.forma[data-forma="pago-movil"]', b => b.disabled), true);
    a.ok((await p.innerText('.capa')).includes('Sin tasa de Bs'));
  }],
  ['Sin conexión y quedan pocas: aviso antes de cobrar', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'B-L', cantidad: 1 }], descuento: null }; c.almacen.simularSinConexion(true); window.dispatchEvent(new CustomEvent('pos:carrito')); });
    await p.click('.lado-carrito .cobrar');
    await p.fill('#cli-tel', '0412-123.45.67');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Estás sin conexión y quedan pocas. Confirma con la tienda antes de cobrar.');
    await p.click('text=Cobrar igual');
    await p.waitForSelector('text=Venta guardada');
  }],
  ['Si otro vendió primero, avisa el producto y el carrito queda igual', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'B-L', cantidad: 1 }], descuento: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); c.almacen._estado('productos').get('B-L').existencia = 0; });
    await p.click('.lado-carrito .cobrar');
    await p.fill('#cli-tel', '0412-123.45.67');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Ya no hay existencia de Buzo Etanol Gris · Talla L');
    a.strictEqual((await ventas(p)).length, 0);
    a.ok(await p.$('.lado-carrito .linea[data-sku="B-L"]'));
    a.deepStrictEqual(p.errores, []);
  }],
]);
