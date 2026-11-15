// Tarea 12: cobrar con pagos mixtos, cliente obligatorio, vuelto, recibo, doble toque, sin tasa y sin conexión.
const { casos } = require('./_servidor.cjs');
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());

async function preparar(env, { sinCliente, ...opciones } = {}) {
  const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender', ...opciones });
  // Buzo S 48.000 + Jogger M 42.000 + 2 bodies (separados, 18.000) = 126.000 − 10.000 de descuento = 116.000
  await p.evaluate(sin => {
    const c = window.__pos.ctx;
    c.carrito = { lineas: [{ sku: 'B-S', cantidad: 1 }, { sku: 'J-M', cantidad: 1 }, { sku: 'Y-6m', cantidad: 1 }, { sku: 'Y-3m', cantidad: 1 }], descuento: { tipo: 'monto', valor: 10000 }, autorizacion: { id: 'a1', por: 'admin', subtotal: 90000 }, cliente: { nombre: 'Ana Pérez', telefono: '584121234567' } }; // autorizado por el admin sobre las prendas con descuento (v2.09: los bodies van aparte)
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
    await p.click('.lado-carrito .cobrar');
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
    a.strictEqual(await texto(p, '.barra-falta'), 'Faltan 0');
    a.ok(await p.$('.barra-falta.ok'));
    const btn = await p.$$eval('.forma', bs => bs.map(b => b.getBoundingClientRect().height));
    for (const hgt of btn) a.ok(hgt >= 48, `forma de ${hgt}px`);
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Venta exitosa');
    const href = await p.getAttribute('a.recibo', 'href');
    a.ok(href.startsWith('https://wa.me/584121234567?text='), href);
    a.strictEqual(await existencia(p, 'B-S'), 2);
    const [v] = await ventas(p);
    a.strictEqual(v.total, 116000);
    a.deepStrictEqual(v.pagos.map(x => [x.forma, x.monto]), [['efectivo-cop', 50000], ['pago-movil', 18192.31]]);
    a.strictEqual(v.descuento.monto, 10000);
    a.ok(v.lineas.every(l => l.reducida === !l.sku.startsWith('Y')), 'descuento → comisión reducida (los bodies «separado» no)');
    await p.click('text=Nueva venta');
    a.strictEqual(await p.$('.lado-carrito .linea'), null);
  }],
  ['Doble clic rápido en Cobrar: una sola venta', async (env, a) => {
    const p = await preparar(env);
    await p.click('.lado-carrito .cobrar');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.dblclick('#cobrar-final');
    await p.waitForSelector('text=Venta exitosa');
    a.strictEqual((await ventas(p)).length, 1);
    a.strictEqual(await existencia(p, 'J-M'), 4);
  }],
  ['Vuelto: solo en monedas con efectivo (ya no hay efectivo en Bs)', async (env, a) => {
    const p = await preparar(env);
    await p.click('.lado-carrito .cobrar');
    await p.click('.forma[data-forma="efectivo-usd"]');
    await p.fill('.pago[data-forma="efectivo-usd"] input', '40');
    a.ok((await texto(p, '.barra-falta')).startsWith('Vuelto'));
    a.strictEqual(await p.$('.vuelto-moneda [data-moneda="BS"]'), null);
    a.ok(await p.$('.vuelto-moneda [data-moneda="USD"]'));
    a.strictEqual(await p.$('.forma[data-forma="efectivo-bs"], .forma[data-forma="punto"]'), null);
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
    await p.waitForSelector('text=Venta exitosa');
  }],
  ['Descuento: al quitar prendas no puede pasar el máximo sin autorización (revisión final)', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true, ruta: '/vender' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'B-S', cantidad: 2 }, { sku: 'F-B-6', cantidad: 2 }], descuento: { tipo: 'monto', valor: 7000 }, autorizacion: null }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    await p.click('.linea[data-sku="B-S"] [aria-label="Menos"]');
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
    await p.waitForSelector('text=Ya no hay existencia de Buzo Etanol Caballero Gris · Talla L');
    a.strictEqual((await ventas(p)).length, 0);
    a.ok(await p.$('.zona-carrito .linea[data-sku="B-L"]'));
    a.deepStrictEqual(p.errores, []);
  }],
  ['Teléfono: Cobrar no abre el teclado solo; el pago elegido aparece debajo del total y el botón Cobrar a la vista', async (env, a) => {
    const p = await preparar(env, { movil: true });
    await p.click('.lado-carrito .cobrar');
    await p.waitForSelector('#cobrar-final');
    await p.waitForTimeout(150);
    a.notStrictEqual(await p.evaluate(() => document.activeElement.tagName), 'INPUT');
    await p.click('.forma[data-forma="efectivo-cop"]');
    a.notStrictEqual(await p.evaluate(() => document.activeElement.tagName), 'INPUT');
    const pos = await p.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      return { pago: r('.pago[data-forma="efectivo-cop"]'), total: r('.total-cobro'), formas: r('.formas-cobro'), final: r('#cobrar-final'), alto: innerHeight };
    });
    a.ok(pos.pago.top > pos.total.bottom && pos.pago.bottom < pos.formas.top, 'el pago va entre el total y las formas');
    a.ok(pos.pago.bottom <= pos.alto, 'el pago agregado debe verse sin desplazarse');
    a.ok(pos.final.bottom <= pos.alto, 'el botón Cobrar debe verse');
  }],
  ['El ejemplo de teléfono no parece un dato escrito', async (env, a) => {
    const p = await preparar(env, { ancho: 360, alto: 780, sinCliente: true });
    await p.click('.lado-carrito .cobrar');
    a.match(await p.getAttribute('#cli-tel', 'placeholder'), /^Ej\. /);
  }],
  ['Carrito: el monto del descuento va alineado a la derecha, como los demás', async (env, a) => {
    const p = await preparar(env);
    const d = await p.evaluate(() => {
      const fila = document.querySelector('.zona-carrito .fila-total.desc'), sub = document.querySelector('.zona-carrito .fila-total:not(.desc) .num');
      return { desc: fila.querySelector('.num').getBoundingClientRect().right, sub: sub.getBoundingClientRect().right };
    });
    a.ok(Math.abs(d.desc - d.sub) < 2, `descuento termina en ${d.desc}, subtotal en ${d.sub}`);
  }],
  ['Cliente en pantalla aparte: nombre primero, sugerencias, Editar desde el cobro y recibo opcional al final', async (env, a) => {
    const p = await preparar(env, { sinCliente: true });
    a.strictEqual(await p.$('.lado-carrito #cli-registrar'), null, 'el carrito ya no registra cliente');
    await p.click('.lado-carrito .cobrar');
    await p.waitForSelector('.capa.ventana.completa #cli-nombre');
    a.deepStrictEqual(await p.$$eval('.capa .cliente label', l => l.map(x => x.textContent)), ['Nombre del cliente', 'Teléfono']);
    await p.click('#cli-guardar');
    a.ok(await p.isVisible('.campo .error:text("Escribe el nombre del cliente")'));
    await p.fill('#cli-nombre', 'ana');
    await p.click('.sug-cli:has-text("Ana Pérez")');
    a.strictEqual(await p.inputValue('#cli-tel'), '0412 123 4567');
    await p.fill('#cli-nombre', 'Luis'); await p.fill('#cli-tel', '0414-555.12.12');
    await p.click('#cli-guardar');
    await p.waitForSelector('#cobrar-final');
    await p.click('#cobro-cli-editar');
    await p.fill('#cli-nombre', 'Luis Mora'); await p.click('#cli-guardar');
    await p.waitForSelector('.cliente-resumen:has-text("Luis Mora")');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Venta exitosa');
    a.ok(await p.$('a.recibo'), 'el recibo es un botón opcional al final');
    const [v] = await ventas(p);
    a.deepStrictEqual(v.cliente, { nombre: 'Luis Mora', telefono: '584145551212' });
  }],
  ['Las formas ya agregadas quedan resaltadas y ningún botón queda marcado por el foco', async (env, a) => {
    const p = await preparar(env, { movil: true });
    await p.click('.lado-carrito .cobrar');
    await p.click('.forma[data-forma="efectivo-usd"]');
    a.deepStrictEqual(await p.$$eval('.forma-cobro.activa', e => e.map(x => x.dataset.formaCard)), ['efectivo-usd']);
    a.strictEqual(await p.evaluate(() => document.activeElement.classList.contains('forma')), false);
  }],
  ['El carrito muestra en dólares y bolívares lo mismo que se cobrará (redondeado hacia arriba)', async (env, a) => {
    const p = await preparar(env);
    a.strictEqual(await texto(p, '.barra-cobro .equivalentes'), '29,75 USD · 31.974,36 Bs'); // 116.000 COP
  }],
  ['El texto del tramo en el carrito se lee (12 px o más)', async (env, a) => {
    const p = await preparar(env);
    await p.click('.zona-carrito .linea.mini');
    const tam = await p.$eval('.zona-carrito .linea .lc-tramo', e => parseFloat(getComputedStyle(e).fontSize));
    a.ok(tam >= 12, `${tam}px`);
  }],
  ['Registrar cliente y pasar al cobro: al cerrar sigue en la app', async (env, a) => {
    const p = await preparar(env, { sinCliente: true });
    await p.click('.lado-carrito .cobrar');
    await p.fill('#cli-tel', '0412-123.45.67'); await p.click('#cli-guardar');
    await p.waitForSelector('#cobrar-final');
    await p.goBack(); // v2.06: el cobro no tiene flecha ni X; se cierra con atrás (o Esc)
    await p.waitForTimeout(300);
    a.strictEqual(await p.evaluate(() => typeof window.__pos), 'object');
    a.strictEqual(await p.evaluate(() => history.state), null, 'vuelve a la entrada base del historial');
  }],
  ['v2.06 · Cobro: tocar el monto no quita el pago; en el teléfono se quita deslizando (sin papelera); descuento fuera del total; «Faltan»', async (env, a) => {
    const p = await preparar(env, { ancho: 390, alto: 844 });
    await p.click('.lado-carrito .cobrar');
    await p.waitForSelector('#cobrar-final');
    a.strictEqual(await p.$('.capa .cb-volver'), null, 'sin flecha atrás');
    a.strictEqual(await p.$('.cb-total #car-descuento'), null, 'el descuento va fuera del recuadro verde');
    a.ok(await p.isVisible('.cb-desc #car-descuento'));
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.click('.pago[data-forma="efectivo-cop"] input');
    await p.waitForTimeout(300);
    a.strictEqual(await p.$$eval('.pagos .pago', e => e.length), 1, 'tocar el monto no quita el pago');
    a.strictEqual(await p.isVisible('.pago-quitar'), false, 'sin papelera en el teléfono');
    await p.fill('.pago[data-forma="efectivo-cop"] input', '50.000');
    a.match(await p.innerText('.barra-falta'), /^Faltan/);
    const b = await (await p.$('.pagos .pago')).boundingBox(), y = b.y + b.height / 2;
    await p.mouse.move(b.x + b.width - 30, y); await p.mouse.down();
    for (let x = b.x + b.width - 30; x > 8; x -= 20) await p.mouse.move(x, y);
    await p.mouse.up();
    await p.waitForFunction(() => !document.querySelector('.pagos .pago'));
    a.strictEqual(await p.$eval('.forma[data-forma="efectivo-cop"]', e => e.getAttribute('aria-pressed')), 'false');
  }],
  ['v2.07 · Teléfono: tocar el monto no selecciona el texto (sin menú Cortar/Copiar); computadora sí selecciona todo', async (env, a) => {
    for (const [opc, selecciona] of [[{ ancho: 390, alto: 844 }, false], [{ ancho: 1440, alto: 900 }, true]]) {
      const p = await preparar(env, opc);
      await p.click('.lado-carrito .cobrar'); await p.waitForSelector('#cobrar-final');
      await p.click('.forma[data-forma="efectivo-cop"]'); await p.waitForTimeout(300);
      await p.$eval('.pago[data-forma="efectivo-cop"] input', i => i.blur());
      if (selecciona) await p.focus('.pago[data-forma="efectivo-cop"] input'); else await p.tap('.pago[data-forma="efectivo-cop"] input').catch(() => p.click('.pago[data-forma="efectivo-cop"] input'));
      await p.waitForTimeout(100);
      const r = await p.$eval('.pago[data-forma="efectivo-cop"] input', i => [i.selectionStart, i.selectionEnd, i.value.length]);
      a.strictEqual(r[0] !== r[1], selecciona, `${opc.ancho}px: selección ${r}`);
    }
  }],
  ['v2.08 · Cobro: la barra Vuelto ↔ Faltan cambia de alto con animación; quitar un pago con monto ofrece Deshacer', async (env, a) => {
    const p = await preparar(env, { ancho: 1440, alto: 900 });
    await p.click('.lado-carrito .cobrar'); await p.waitForSelector('#cobrar-final');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.fill('.pago[data-forma="efectivo-cop"] input', '200.000');
    await p.waitForSelector('.barra-falta.vuelto');
    await p.fill('.pago[data-forma="efectivo-cop"] input', '50.000');
    a.ok(await p.$eval('.barra-falta', b => b.getAnimations().some(x => x.effect.getKeyframes().some(k => k.height))), 'el alto se anima');
    await p.click('.pago-quitar');
    await p.waitForSelector('.toast button:has-text("Deshacer")');
    await p.click('.toast button:has-text("Deshacer")');
    await p.waitForSelector('.pago[data-forma="efectivo-cop"]');
    a.strictEqual(await p.inputValue('.pago[data-forma="efectivo-cop"] input'), '50.000', 'vuelve con su monto');
    await p.click('.forma[data-forma="transferencia-cop"]'); await p.waitForTimeout(300);
    await p.fill('.pago[data-forma="transferencia-cop"] input', '');
    await p.click('.pago[data-forma="transferencia-cop"] .pago-quitar'); await p.waitForTimeout(400);
    a.strictEqual(await p.$('.toast button'), null, 'un pago vacío se quita sin Deshacer');
  }],
  ['v2.09 · «separado»: los bodies no suman al tramo de las demás ni llevan descuento; la venta lo guarda así', async (env, a) => {
    const p = await preparar(env); // Buzo + Jogger normales; 2 bodies «separado»; descuento 10.000 autorizado
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.productos['Y-6m'].separado), true);
    await p.click('.lado-carrito .cobrar'); await p.waitForSelector('#cobrar-final');
    await p.click('.forma[data-forma="efectivo-cop"]');
    await p.click('#cobrar-final');
    await p.waitForSelector('.exito');
    const v = await p.evaluate(() => [...window.__pos.ctx.almacen._estado('ventas').values()][0]);
    a.strictEqual(v.total, 116000);
    const d = Object.fromEntries(v.lineas.map(l => [l.sku, l.descuento]));
    a.strictEqual(d['Y-6m'] + d['Y-3m'], 0, 'los bodies no llevan descuento');
    a.strictEqual(d['B-S'] + d['J-M'], 10000);
    a.deepStrictEqual(v.lineas.filter(l => l.sku.startsWith('Y')).map(l => l.reducida), [false, false]);
  }],
]);
