// Tarea 12: cobrar con pagos mixtos, cliente obligatorio, vuelto, recibo, doble toque, sin tasa y sin conexión.
const { casos } = require('./_servidor.cjs');
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());

async function preparar(env, { sinCliente, ...opciones } = {}) {
  const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender', ...opciones });
  // Buzo S 48.000 + Jogger M 42.000 + 2 bodies (separados, 18.000) = 126.000 − 10.000 de descuento = 116.000
  await p.evaluate(sin => {
    const c = window.__pos.ctx;
    c.carrito = { lineas: [{ sku: 'B-S', cantidad: 1 }, { sku: 'J-M', cantidad: 1 }, { sku: 'Y-6m', cantidad: 1 }, { sku: 'Y-3m', cantidad: 1 }], descuento: { tipo: 'monto', valor: 10000 }, autorizacion: { id: 'a1', por: 'admin', subtotal: 126000 }, cliente: { nombre: 'Ana Pérez', telefono: '584121234567' } }; // 7,9%: autorizado por el admin
    if (sin) delete c.carrito.cliente;
    window.dispatchEvent(new CustomEvent('pos:carrito'));
  }, !!sinCliente);
  return p;
}
const existencia = (p, sku) => p.evaluate(s => window.__pos.ctx.productos[s].existencia, sku);
const ventas = p => p.evaluate(() => [...window.__pos.ctx.almacen._estado('ventas').values()]);

casos('cobrar', [
  ['Cobrar sin cliente pide registrarlo primero; teléfono conocido completa el nombre', async (env, a) => {
    const p = await preparar(env, { ancho: 360, alto: 780, sinCliente: true });
    await p.click('.barra-carrito'); await p.click('.capa .cobrar');
    await p.waitForSelector('.capa #cli-tel');
    a.strictEqual(await p.$('#cobrar-final'), null, 'todavía no abre el cobro');
    await p.fill('#cli-tel', '0412-123.45.67');
    a.strictEqual(await p.inputValue('#cli-nombre'), 'Ana Pérez');
    await p.click('#cli-guardar');
    await p.waitForSelector('#cobrar-final');
    a.ok(await p.$('.capa.ventana.completa'));
    a.strictEqual(await texto(p, '#cobrar-final'), 'Cobrar 116.000');
    a.strictEqual(await p.$eval('#cobrar-final', b => b.disabled), true);
    a.match(await texto(p, '.cliente-resumen'), /Ana Pérez.*0412 123 4567/);
  }],
  ['Pago mixto: efectivo pesos 50.000 + pago móvil sugerido = Falta 0', async (env, a) => {
    const p = await preparar(env);
    await p.click('.lado-carrito .cobrar');
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
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'B-L', cantidad: 1 }], descuento: null, cliente: { nombre: 'Ana Pérez', telefono: '584121234567' } }; c.almacen.simularSinConexion(true); window.dispatchEvent(new CustomEvent('pos:carrito')); });
    await p.click('.lado-carrito .cobrar');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Estás sin conexión y quedan pocas. Confirma con la tienda antes de cobrar.');
    await p.click('text=Cobrar igual');
    await p.waitForSelector('text=Venta guardada');
  }],
  ['Descuento: al quitar prendas no puede pasar el máximo sin autorización (revisión final)', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'B-S', cantidad: 2 }, { sku: 'F-B-6', cantidad: 2 }], descuento: { tipo: 'monto', valor: 7000 }, autorizacion: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    await p.click('.linea[data-sku="B-S"] [aria-label="Quitar"]');
    await p.waitForSelector('text=Se quitó el descuento');
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.carrito.descuento), null);
  }],
  ['F9 dos veces abre una sola ventana de cobro (revisión final)', async (env, a) => {
    const p = await preparar(env);
    await p.click('.vista'); await p.keyboard.press('F9'); await p.keyboard.press('F9');
    a.strictEqual(await p.$$eval('#cobrar-final', x => x.length), 1);
  }],
  ['Si cambian los precios mientras se cobra, no guarda una venta distinta (revisión final)', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', caja: true, ruta: '/vender' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'J-M', cantidad: 1 }], descuento: null, cliente: { nombre: 'Ana Pérez', telefono: '584121234567' } }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    await p.click('.lado-carrito .cobrar');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.evaluate(() => window.__pos.ctx.almacen.aplicarImportacion({ nuevos: [], cambios: [{ sku: 'J-M', campos: { precios: [50000, 40000, 38000, 36000, 34000] } }], iguales: [], faltantes: [] }));
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Los precios cambiaron');
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.almacen._estado('ventas').size), 0);
  }],
  ['Si otro vendió primero, avisa el producto y el carrito queda igual', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'B-L', cantidad: 1 }], descuento: null, cliente: { nombre: 'Ana Pérez', telefono: '584121234567' } }; window.dispatchEvent(new CustomEvent('pos:carrito')); c.almacen._estado('productos').get('B-L').existencia = 0; });
    await p.click('.lado-carrito .cobrar');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Ya no hay existencia de Buzo Etanol Gris · Talla L');
    a.strictEqual((await ventas(p)).length, 0);
    a.ok(await p.$('.lado-carrito .linea[data-sku="B-L"]'));
    a.deepStrictEqual(p.errores, []);
  }],
  ['Teléfono: Cobrar no abre el teclado solo; el pago agregado queda arriba y el botón Cobrar a la vista', async (env, a) => {
    const p = await preparar(env, { movil: true });
    await p.click('.barra-carrito'); await p.click('.capa .cobrar');
    await p.waitForSelector('#cobrar-final');
    await p.waitForTimeout(150);
    a.notStrictEqual(await p.evaluate(() => document.activeElement.tagName), 'INPUT');
    await p.click('.forma[data-forma="efectivo-cop"]');
    a.notStrictEqual(await p.evaluate(() => document.activeElement.tagName), 'INPUT');
    const pos = await p.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      return { pago: r('.pago[data-forma="efectivo-cop"]'), formas: r('.formas'), final: r('#cobrar-final'), alto: innerHeight };
    });
    a.ok(pos.pago.top < pos.formas.top, 'los pagos deben ir antes que los botones de formas');
    a.ok(pos.pago.bottom <= pos.alto, 'el pago agregado debe verse sin desplazarse');
    a.ok(pos.final.bottom <= pos.alto, 'el botón Cobrar debe verse');
    a.ok(pos.formas.height < 330, `las formas de pago ocupan ${Math.round(pos.formas.height)} px`);
  }],
  ['El ejemplo de teléfono no parece un dato escrito', async (env, a) => {
    const p = await preparar(env, { ancho: 360, alto: 780, sinCliente: true });
    await p.click('.barra-carrito'); await p.click('.capa #cli-registrar');
    a.match(await p.getAttribute('#cli-tel', 'placeholder'), /^Ej\. /);
  }],
  ['Carrito: el monto del descuento va alineado a la derecha, como los demás', async (env, a) => {
    const p = await preparar(env);
    const d = await p.evaluate(() => {
      const fila = document.querySelector('.lado-carrito .fila-total.desc'), sub = document.querySelector('.lado-carrito .fila-total:not(.desc) .num');
      return { desc: fila.querySelector('.num').getBoundingClientRect().right, sub: sub.getBoundingClientRect().right };
    });
    a.ok(Math.abs(d.desc - d.sub) < 2, `descuento termina en ${d.desc}, subtotal en ${d.sub}`);
  }],
  ['Carrito: Registrar cliente, Editar y "Enviar recibo" opcional', async (env, a) => {
    const p = await preparar(env, { sinCliente: true });
    await p.click('.lado-carrito #cli-registrar');
    await p.click('#cli-guardar');
    a.ok(await p.isVisible('.campo .error:text("Escribe el teléfono del cliente")'));
    await p.fill('#cli-tel', '0414-555.12.12'); await p.fill('#cli-nombre', 'Luis');
    await p.click('#cli-guardar');
    await p.waitForSelector('.lado-carrito .cliente-carrito');
    a.match(await texto(p, '.lado-carrito .cliente-carrito'), /Luis.*0414 555 1212/);
    a.strictEqual(await p.getAttribute('.lado-carrito #cli-recibo', 'aria-checked'), 'true');
    await p.click('.lado-carrito #cli-editar');
    a.strictEqual(await p.inputValue('#cli-nombre'), 'Luis');
    await p.fill('#cli-nombre', 'Luis Mora'); await p.click('#cli-guardar');
    await p.waitForSelector('.lado-carrito .cliente-carrito:has-text("Luis Mora")');
    await p.click('.lado-carrito #cli-recibo');
    a.strictEqual(await p.getAttribute('.lado-carrito #cli-recibo', 'aria-checked'), 'false');
    await p.click('.lado-carrito .cobrar');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Venta guardada');
    a.strictEqual(await p.$('a.recibo'), null, 'sin recibo no ofrece enviarlo');
    const [v] = await ventas(p);
    a.deepStrictEqual(v.cliente, { nombre: 'Luis Mora', telefono: '584145551212' });
  }],
  ['Las formas ya agregadas se marcan con ✓ y ningún botón queda marcado por el foco', async (env, a) => {
    const p = await preparar(env, { movil: true });
    await p.click('.barra-carrito'); await p.click('.capa .cobrar');
    await p.click('.forma[data-forma="efectivo-usd"]');
    a.deepStrictEqual(await p.$$eval('.forma.agregada', e => e.map(x => x.dataset.forma)), ['efectivo-usd']);
    a.strictEqual(await p.evaluate(() => document.activeElement.classList.contains('forma')), false);
  }],
  ['El carrito muestra en dólares y bolívares lo mismo que se cobrará (redondeado hacia arriba)', async (env, a) => {
    const p = await preparar(env);
    a.strictEqual(await texto(p, '.lado-carrito .equivalentes'), '29,75 USD · 31.974,36 Bs'); // 116.000 COP
  }],
  ['El texto del tramo en el carrito se lee (12 px o más)', async (env, a) => {
    const p = await preparar(env);
    const tam = await p.$eval('.lado-carrito .linea .tramo', e => parseFloat(getComputedStyle(e).fontSize));
    a.ok(tam >= 12, `${tam}px`);
  }],
  ['Registrar cliente y pasar al cobro: al cerrar sigue en la app', async (env, a) => {
    const p = await preparar(env, { sinCliente: true });
    await p.click('.lado-carrito .cobrar');
    await p.fill('#cli-tel', '0412-123.45.67'); await p.click('#cli-guardar');
    await p.waitForSelector('#cobrar-final');
    await p.click('.capa .cerrar');
    await p.waitForTimeout(300);
    a.strictEqual(await p.evaluate(() => typeof window.__pos), 'object');
    a.strictEqual(await p.evaluate(() => history.state), null, 'vuelve a la entrada base del historial');
  }],
]);
