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
    await p.waitForSelector('.rep-kpi[data-k="ganancia"]');
    a.strictEqual(await texto(p, '.rep-kpi[data-k="ganancia"] .val'), '99.000');
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
    a.strictEqual(await p.$('.venta-hoy button:has-text("Anular")'), null, 'la lista no tiene botón Anular');
    await p.click('.venta-hoy');
    await p.click('#det-anular');
    await p.fill('#motivo', 'Cliente devolvió');
    await p.click('#motivo-final');
    await p.waitForFunction(() => window.__pos.ctx.productos['J-M'].existencia === 5);
    await p.evaluate(() => { location.hash = '/comisiones'; });
    await p.waitForSelector('#com-pendiente');
    a.ok((await texto(p, '.resumen-com')).includes('Sin comisiones en el período'));
  }],
  ['Comisiones: total y marcar como pagadas', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', caja: true });
    await vender(p);
    await cambiarA(p, 'encargada');
    await p.evaluate(() => { location.hash = '/comisiones'; });
    await p.waitForSelector('#com-pendiente');
    a.strictEqual(await texto(p, '#com-pendiente'), '4.000');
    await p.click('#com-pagar');
    await p.waitForFunction(() => document.querySelector('.resumen-com')?.textContent.includes('Todo pagado'));
  }],
  ['Reportes: más vendidos y existencias bajas', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', caja: true });
    await vender(p);
    await p.evaluate(() => { location.hash = '/reportes'; });
    await p.waitForSelector('.mas-vendidos');
    a.ok((await texto(p, '.mas-vendidos')).includes('Jogger Texcol Negro'));
    await p.click('.rep-fila.bajas');
    a.ok((await texto(p, '.bajas-det')).includes('Buzo Etanol Gris'));
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
    await p.click('#aj-guardar');
    await p.waitForFunction(() => document.querySelector('.topbar .tasas').textContent.includes('4.000'));
    await p.evaluate(() => { location.hash = '/usuarios'; });
    await p.click('#nu-abrir');
    await p.fill('#nu-nombre', 'María Gómez');
    a.strictEqual(await p.inputValue('#nu-usuario'), 'maria', 'el usuario se llena solo');
    a.match(await p.inputValue('#nu-pin'), /^\d{4}$/, 'PIN sugerido');
    await p.click('#nu-rol [data-rol="vendedora"]'); await p.fill('#nu-pin', '5555');
    await p.click('#nu-crear');
    await p.waitForSelector('pre.cred:has-text("PIN: 5555")');
    await p.click('.capa button:has-text("Listo")');
    await p.waitForSelector('.usuario[data-usuario="maria"]');
    await cambiarA(p, 'maria', '5555');
    a.ok(await p.$('.side .nav[aria-label="Vender"]'));
    await cambiarA(p, 'admin');
    await p.evaluate(() => { location.hash = '/usuarios'; });
    await p.click('.usuario[data-usuario="maria"] .u-cab');
    await p.click('.usuario[data-usuario="maria"] button:has-text("Desactivar")');
    await p.waitForSelector('.usuario[data-usuario="maria"] .est.n');
    await p.evaluate(() => window.__pos.ctx.almacen.salir());
    await p.fill('#entrar-usuario', 'maria'); await p.fill('#entrar-pin', '5555'); await p.click('#entrar-btn');
    await p.waitForSelector('text=Usuario desactivado');
    a.deepStrictEqual(p.errores, []);
  }],
  ['Fechas con calendario propio: un solo calendario para el rango, sin el selector del teléfono', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/reportes' });
    a.strictEqual(!!(await p.$('input[type=date]')), false, 'no debe haber selector de fecha del teléfono');
    a.ok(await p.$('.segmentado button:text-is("Semana")'));
    await p.click('#rango-btn');
    await p.waitForSelector('.calendario');
    a.strictEqual(await p.$$eval('.calendario .cal-actual .dia', d => d.length), 42);
    const mes = await p.evaluate(() => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0')]; });
    await p.click(`.calendario .cal-actual .dia[data-fecha="${mes[0]}-${mes[1]}-03"]`);
    await p.click(`.calendario .cal-actual .dia[data-fecha="${mes[0]}-${mes[1]}-05"]`);
    a.strictEqual(await p.$$eval('.calendario .cal-actual .dia.en-rango', d => d.length), 3);
    await p.click('.calendario-aplicar');
    await p.waitForSelector('.calendario', { state: 'detached' });
    a.match(await texto(p, '#rango-btn'), /^3 – 5 \w{3}$/);
  }],
  ['Comisiones: solo gana la vendedora salvo que el administrador marque a otro en Usuarios', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/comisiones' });
    await p.waitForSelector('.com-hero');
    a.ok((await texto(p, '.com-hero')).includes('Vendedora'));
    a.ok(await p.$eval('#com-vendedor', e => e.hidden), 'con una sola persona no hay selector');
    await p.evaluate(() => { location.hash = '/usuarios'; });
    a.strictEqual(await p.$eval('[data-comision="encargada"]', e => e.checked), false);
    a.strictEqual(await p.$eval('[data-comision="vendedora"]', e => e.checked), true);
    await p.click('.usuario[data-usuario="encargada"] .u-cab');
    await p.click('[data-comision="encargada"]');
    await p.evaluate(() => { location.hash = '/comisiones'; });
    await p.waitForSelector('#com-vendedor:not([hidden]) [data-usuario="encargada"]');
    a.strictEqual(!!(await p.$('select')), false, 'no debe haber lista del teléfono');
  }],
  ['Reportes: "Más vendidos" vacío lo dice', async (env, a) => {
    const p = await env.pagina({ ruta: '/reportes' });
    a.match(await texto(p, '.mas-vendidos'), /Sin ventas en este período/);
  }],
  ['Teléfono: los textos de los recuadros de Inicio caben en una línea', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780 });
    const altos = await p.$$eval('.tile .sub', els => els.map(e => [e.textContent, Math.round(e.getBoundingClientRect().height)]));
    for (const [t, alto] of altos) a.ok(alto <= 20, `«${t}» ocupa ${alto} px`);
  }],
  ['Ajustes de tasas como la Calculadora: tarjetas Binance/BCV/Manual con su tasa; recargo solo en Binance', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/ajustes' });
    await p.evaluate(() => { const c = window.__pos.ctx; c.tasaRemota = { rate: 1074.57, updated_at: new Date(Date.now() - 15 * 60000).toISOString(), bcv: { rate: 904.45, updated_at: new Date(Date.now() - 15 * 60000).toISOString() } }; location.hash = '/mas'; });
    await p.evaluate(() => { location.hash = '/ajustes'; });
    await p.waitForSelector('#aj-bs-modo .modo-bs');
    a.match(await p.innerText('.fila-usd:has(#aj-cop)'), /1 USD =/);
    await p.click('#aj-bs-modo [data-modo="binance"]');
    await p.fill('#aj-recargo', '15');
    a.match(await p.innerText('[data-modo="binance"]'), /Binance 1\.074,57 · hace 15 min/);
    a.match(await p.innerText('[data-modo="binance"] .modo-val'), /1\.089,57 Bs\./);
    a.match(await p.innerText('[data-modo="bcv"] .modo-val'), /904,45 Bs\./);
    a.strictEqual(await p.isVisible('#aj-recargo'), true);
    await p.click('#aj-bs-modo [data-modo="bcv"]');
    a.strictEqual(await p.isVisible('#aj-recargo'), false);
    a.strictEqual(await p.getAttribute('[data-modo="bcv"]', 'aria-checked'), 'true');
    await p.fill('#aj-bs-manual', '1.100');
    a.strictEqual(await p.getAttribute('[data-modo="manual"]', 'aria-checked'), 'true', 'escribir la tasa manual la elige');
    await p.click('#aj-guardar');
    await p.waitForFunction(() => window.__pos.ctx.ajustesTasas?.bsModo === 'manual');
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.tasas.bsPorUsd), 1100);
  }],
  ['Ajustes: comisiones con punto de miles y nombres de formas de pago completos', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/ajustes' });
    await p.click('#aj-tab-venta');
    a.strictEqual(await p.$('#aj-tienda'), null, 'sin nombre de la tienda');
    a.strictEqual(await p.$('#aj-desc-max'), null, 'sin descuento máximo de la vendedora');
    a.strictEqual(await p.isVisible('#aj-com-0-normal'), false, 'la comisión va plegada');
    await p.click('#aj-comision summary');
    a.strictEqual(await p.inputValue('#aj-com-0-normal'), '4.000');
    a.match(await p.getAttribute('#aj-com-4-normal', 'placeholder'), /Igual que 24–48/);
    const cortados = await p.$$eval('.forma-aj input.inp', els => els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.value));
    a.deepStrictEqual(cortados, []);
  }],
  ['Los recuadros usan los colores de moneda solo para monedas', async (env, a) => {
    for (const ruta of ['/inicio', '/reportes', '/inventario']) {
      const p = await env.pagina({ ruta });
      const malos = await p.$$eval('.tile', e => e.filter(x => /--(cop|usd|bs)\)/.test(x.getAttribute('style') || '')).map(x => x.textContent.slice(0, 30)));
      a.deepStrictEqual(malos, [], ruta);
      await p.context().close();
    }
  }],
  ['Ajustes: un solo "Guardar cambios" fijo al final que se activa al cambiar algo', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/ajustes' });
    a.strictEqual(await p.$$eval('button', b => b.filter(x => !x.closest('.aviso-guardar') && /^Guardar( tasas)?$/.test(x.textContent.trim())).length), 0);
    a.strictEqual(await p.isDisabled('#aj-guardar'), true);
    await p.click('#aj-tab-venta');
    await p.fill('#aj-redondeo', '50');
    a.strictEqual(await p.isDisabled('#aj-guardar'), false);
    await p.click('#aj-guardar');
    await p.waitForFunction(() => window.__pos.ctx.ajustes.redondeo === 50);
    await p.waitForFunction(() => document.querySelector('#aj-guardar').disabled);
  }],
  ['Calendario: "hoy" se distingue aunque esté elegido', async (env, a) => {
    const p = await env.pagina({ ruta: '/reportes' });
    await p.click('#rango-btn');
    const c = await p.$eval('.calendario .cal-actual .dia.hoy', e => getComputedStyle(e, '::after').content);
    a.notStrictEqual(c, 'none');
  }],
  ['Ajustes: 4 apartados, sin modo oscuro; formas de pago en tarjetas que se activan, agregan y eliminan', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/ajustes' });
    a.deepStrictEqual(await p.$$eval('.pestanas-aj button', b => b.map(x => x.textContent)), ['Tasas', 'Venta', 'Pagos', 'Recibo']);
    a.strictEqual(await p.$('text=Apariencia'), null);
    a.strictEqual(await p.$('#aj-tema'), null);
    a.strictEqual(await p.$('text=/oscuro/i'), null);
    await p.click('#aj-tab-pagos');
    const zelle = '.forma-tarjeta[data-forma="zelle"]';
    a.ok(await p.$(zelle + '.activa'));
    await p.click(zelle + ' .forma-toque');
    a.strictEqual(await p.$(zelle + '.activa'), null);
    a.strictEqual(await p.$eval(zelle, e => getComputedStyle(e).opacity), '0.5');
    const cols = await p.$$eval('.formas-aj .forma-tarjeta', e => new Set(e.map(x => Math.round(x.getBoundingClientRect().left))).size);
    a.strictEqual(cols, 2, 'formas de pago en dos columnas');
    a.ok(!(await texto(p, '.formas-aj')).match(/Activa|Apagada/), 'sin texto de activa/apagada');
    await p.click('.forma-tarjeta[data-forma="usdt"] [aria-label^="Opciones"]');
    await p.click('.forma-tarjeta[data-forma="usdt"] [aria-label^="Eliminar"]');
    a.strictEqual(await p.$('.forma-tarjeta[data-forma="usdt"]'), null);
    await p.click('#aj-forma-nueva');
    await p.fill('#fp-nombre', 'Bancolombia'); await p.click('#fp-moneda [data-moneda="COP"]'); await p.click('.iconos-forma [data-icono="movil"]');
    await p.click('#fp-guardar');
    a.ok(await p.$('.forma-tarjeta[data-forma="bancolombia"].activa'));
    await p.click('#aj-guardar');
    await p.waitForFunction(() => window.__pos.ctx.ajustes.formasPago.some(f => f.id === 'bancolombia'));
    const f = await p.evaluate(() => window.__pos.ctx.ajustes.formasPago.map(x => [x.id, x.activa !== false]));
    a.ok(!f.some(x => x[0] === 'usdt'));
    a.deepStrictEqual(f.find(x => x[0] === 'zelle'), ['zelle', false]);
    a.deepStrictEqual(f.find(x => x[0] === 'bancolombia'), ['bancolombia', true]);
  }],
  ['Ajustes: el recibo se edita con vista previa arriba y variables, y se usa al vender', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/ajustes' });
    await p.click('#aj-tab-recibo');
    const orden = await p.$eval('#aj-recibo-vista', v => v.getBoundingClientRect().top < document.querySelector('#aj-plantilla').getBoundingClientRect().top);
    a.ok(orden, 'la vista previa va primero');
    a.match(await p.innerText('#aj-recibo-vista'), /Hola, Juan Pérez/);
    await p.fill('#aj-plantilla', 'Gracias ');
    await p.click('.chips-recibo [data-variable="cliente"]');
    a.strictEqual(await p.inputValue('#aj-plantilla'), 'Gracias {cliente}');
    a.strictEqual(await p.innerText('#aj-recibo-vista'), 'Gracias Juan Pérez');
    await p.click('#aj-guardar');
    await p.waitForFunction(() => window.__pos.ctx.ajustes.recibo?.plantilla === 'Gracias {cliente}');
    await p.click('#aj-recibo-original');
    a.match(await p.innerText('#aj-recibo-vista'), /Resumen de tu compra/);
  }],
  ['Más → Usuarios (debajo de Comisiones) con Mi cuenta al final; Más ya no tiene Mi cuenta', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/mas' });
    const filas = await p.$$eval('.lista-mas .mas-t', b => b.map(x => x.textContent.trim()));
    a.ok(filas.indexOf('Usuarios') === filas.indexOf('Comisiones') + 1, filas.join(','));
    a.strictEqual(await p.$('.vista .cuenta'), null);
    await p.click('.lista-mas .fila-btn:has-text("Usuarios")');
    await p.waitForSelector('.usuario[data-usuario="admin"]');
    a.ok(await p.$eval('#mi-cuenta', m => m === m.parentElement.lastElementChild), 'Mi cuenta va de último');
    a.strictEqual(await p.$('.pestanas-aj'), null);
  }],
  ['Ajustes: cambiar solo el modo de Bs muestra "Guardar" y queda guardado; sin título de pantalla', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/ajustes' });
    a.strictEqual(await p.$('.vista h1'), null);
    await p.click('#aj-bs-modo [data-modo="bcv"]');
    a.strictEqual(await p.isDisabled('#aj-guardar'), false);
    await p.click('#aj-guardar');
    await p.waitForFunction(() => window.__pos.ctx.ajustesTasas?.bsModo === 'bcv');
    await p.evaluate(() => { location.hash = '/mas'; }); await p.evaluate(() => { location.hash = '/ajustes'; });
    a.strictEqual(await p.getAttribute('#aj-bs-modo [data-modo="bcv"]', 'aria-pressed'), 'true');
  }],
  ['Modo prueba (admin, en Más arriba de la versión): llena la app con ejemplos y se quitan sin tocar lo real', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/mas' });
    const orden = await p.$eval('#modo-prueba', b => b.getBoundingClientRect().top < document.querySelector('.ver-pie').getBoundingClientRect().top);
    a.ok(orden, 'arriba de la versión');
    const antes = await p.evaluate(() => window.__pos.ctx.almacen._estado('ventas').size);
    await p.click('#modo-prueba');
    await p.waitForSelector('#modo-prueba.on');
    a.ok(await p.evaluate(() => [...window.__pos.ctx.almacen._estado('ventas').values()].filter(v => v.demo).length >= 30));
    await p.evaluate(() => { location.hash = '/apartados'; });
    await p.waitForSelector('.apartado');
    a.ok(await p.$('.ap-dias'), 'un apartado con más de 15 días');
    await p.evaluate(() => { location.hash = '/mas'; });
    await p.click('#modo-prueba'); await p.click('#quitar-ejemplos');
    await p.waitForSelector('#modo-prueba:not(.on)');
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.almacen._estado('ventas').size), antes);
  }],
  ['Modo prueba: solo el administrador lo ve', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'encargada', ruta: '/mas' });
    await p.waitForSelector('.lista-mas');
    a.strictEqual(await p.$('#modo-prueba'), null);
  }],
]);
