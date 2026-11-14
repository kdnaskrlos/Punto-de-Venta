// Tarea 15: inventario — consulta en teléfono, importar con vista previa, ajustes, ofertas, fotos y permisos.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { casos } = require('./_servidor.cjs');
const texto = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());
const INV = JSON.parse(fs.readFileSync(path.join(__dirname, '../nucleo/ejemplos/inventario.json'), 'utf8'));
const existencia = (p, sku) => p.evaluate(s => window.__pos.ctx.productos[s]?.existencia, sku);

async function servirInventario(p, datos) {
  await p.route(/App-Inventario\/data\/inventario\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
}

casos('inventario', [
  ['Teléfono: la vendedora consulta existencia y precios, sin costos ni acciones', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'vendedora', ruta: '/inventario' });
    await p.fill('#buscar-inv', 'jogger');
    await p.click('.grupo-inv[data-nombre="Jogger Texcol Caballero Negro"]');
    const t = await texto(p, '.capa');
    for (const x of ['Talla M', '5', '42.000', '40.000', '38.000', '36.000', '34.000', '48+']) a.ok(t.includes(x), `falta ${x}`);
    a.ok(!t.includes('Costo'), 'la vendedora no ve costos');
    for (const b of ['Sincronizar inventario', 'Fotos', 'Ajustar', 'Oferta']) a.strictEqual(await p.$(`button:has-text("${b}")`), null, b);
  }],
  ['Admin: sincronizar muestra la vista previa y solo guarda al aplicar; la existencia de los que ya existen no se pisa', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    await servirInventario(p, INV);
    a.match(await texto(p, '#sinc-ultima'), /Aún no se ha sincronizado/);
    await p.click('#sinc-abrir');
    await p.waitForFunction(() => document.querySelector('.resumen-imp.g')?.innerText.replace(/\s+/g, ' ').trim() === '3 nuevos');
    a.match(await texto(p, '.sinc-fecha'), /Archivo del .*· 3 filas/);
    a.strictEqual(await p.evaluate(() => !!window.__pos.ctx.productos['Fran-AS-Niño-4-Bla-Alg']), false, 'nada se guarda antes de aplicar');
    await p.click('#sinc-cancelar');
    a.strictEqual(await p.evaluate(() => !!window.__pos.ctx.productos['Fran-AS-Niño-4-Bla-Alg']), false, 'cancelar no guarda');
    await p.click('#sinc-abrir');
    await p.click('#sinc-aplicar');
    await p.waitForSelector('text=Inventario sincronizado');
    a.strictEqual(await existencia(p, 'Fran-AS-Niño-4-Bla-Alg'), 12);
    a.match(await texto(p, '#sinc-ultima'), /Última sincronización: /);
    await p.evaluate(() => { window.__pos.ctx.almacen._estado('productos').get('Fran-AS-Niño-4-Bla-Alg').existencia = 3; });
    const cambiado = JSON.parse(JSON.stringify(INV));
    cambiado.rows[0][cambiado.head.indexOf('precio1')] = '27000';
    cambiado.rows[0][cambiado.head.indexOf('minimo')] = '4';
    await p.unroute(/App-Inventario/); await servirInventario(p, cambiado);
    await p.click('#sinc-abrir');
    await p.waitForFunction(() => document.querySelector('.resumen-imp.b')?.innerText.replace(/\s+/g, ' ').trim() === '1 actualizado');
    await p.click('.sinc-lista summary');
    const det = await texto(p, '.sinc-lista');
    a.ok(det.includes('precio1 25000 → 27000') && det.includes('minimo 5 → 4'), det);
    a.strictEqual(await p.isChecked('#sinc-existencia'), false, 'casilla desmarcada por defecto');
    await p.click('#sinc-aplicar');
    await p.waitForSelector('text=Inventario sincronizado');
    await p.waitForFunction(() => window.__pos.ctx.productos['Fran-AS-Niño-4-Bla-Alg'].precios[0] === 27000);
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.productos['Fran-AS-Niño-4-Bla-Alg'].minimo), 4, 'mínimo sí se actualiza');
    a.strictEqual(await existencia(p, 'Fran-AS-Niño-4-Bla-Alg'), 3, 'existencia del POS intacta');
  }],
  ['Admin: con «Actualizar también existencia» la del archivo reemplaza la del POS', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    await servirInventario(p, INV);
    await p.click('#sinc-abrir'); await p.click('#sinc-aplicar'); await p.waitForSelector('text=Inventario sincronizado');
    await p.evaluate(() => window.__pos.ctx.almacen.ajustarExistencia('Fran-AS-Niño-4-Bla-Alg', -9, 'Venta', 'prueba')); // como si se hubieran vendido 9
    await p.waitForFunction(() => window.__pos.ctx.productos['Fran-AS-Niño-4-Bla-Alg'].existencia === 3);
    await p.click('#sinc-abrir');
    await p.waitForSelector('#sinc-existencia');
    a.match(await texto(p, '.capa:last-of-type .sinc-check'), /1 producto que ya existe tiene otra existencia/);
    await p.check('#sinc-existencia');
    await p.click('#sinc-aplicar'); await p.waitForSelector('text=Inventario sincronizado');
    a.strictEqual(await existencia(p, 'Fran-AS-Niño-4-Bla-Alg'), 12);
  }],
  ['Sin internet o archivo dañado: mensaje claro y no cambia nada', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    await p.route(/App-Inventario\/data\/inventario\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{roto' }));
    await p.click('#sinc-abrir');
    await p.waitForSelector('text=no es un inventario válido');
    a.ok(await p.isDisabled('#sinc-aplicar'));
    await p.click('#sinc-cancelar');
    await p.unroute(/App-Inventario/);
    await p.route(/App-Inventario\/data\/inventario\.json/, r => r.abort());
    await p.click('#sinc-abrir');
    await p.waitForSelector('text=No se cambió nada en el punto de venta');
    a.match(await texto(p, '.capa:last-of-type'), /Sin conexión/);
  }],
  ['Admin: ajuste +3 "Llegó del taller" y queda en el historial', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    await p.click('.grupo-inv[data-nombre="Jogger Texcol Caballero Negro"]');
    await p.click('.talla-fila[data-sku="J-M"] button:has-text("Ajustar")');
    await p.fill('#ajuste-cantidad', '3');
    await p.selectOption('#ajuste-motivo', 'Llegó del taller');
    await p.click('#ajuste-final');
    await p.waitForFunction(() => window.__pos.ctx.productos['J-M'].existencia === 8);
    await p.click('.talla-fila[data-sku="J-M"] button:has-text("Historial")');
    a.ok((await texto(p, '.capa:last-of-type')).includes('Llegó del taller'));
  }],
  ['Admin: oferta del 10% cambia el precio en Vender', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', caja: true, ruta: '/inventario' });
    await p.click('.grupo-inv[data-nombre="Jogger Texcol Caballero Negro"]');
    await p.click('.capa button:has-text("Oferta")');
    await p.fill('#oferta-pct', '10');
    await p.click('#oferta-final');
    await p.waitForFunction(() => window.__pos.ctx.productos['J-M'].oferta?.activa === true);
    await p.evaluate(() => { location.hash = '/vender'; });
    await p.waitForSelector('.tarjeta-prenda[data-nombre="Jogger Texcol Caballero Negro"] .tp-estado');
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'J-M', cantidad: 1 }] }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    a.strictEqual(await texto(p, '.carrito .total-cop'), '37.800');
  }],
  ['Admin: fotos por sku (nombre del archivo); las que no coinciden quedan sin asignar', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#888' } }).png().toBuffer();
    await p.click('button:has-text("Fotos")');
    await p.setInputFiles('#fotos-archivos', [{ name: 'j-m.png', mimeType: 'image/png', buffer: png }, { name: 'otra.png', mimeType: 'image/png', buffer: png }]);
    await p.waitForSelector('text=1 asignada');
    a.ok((await texto(p, '.sin-asignar')).includes('otra.png'));
    await p.click('#fotos-final');
    await p.waitForFunction(() => !!window.__pos.ctx.productos['J-M'].foto);
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.productos['J-L'].foto), null, 'solo esa variante');
    a.ok(await p.$('.grupo-inv[data-nombre="Jogger Texcol Caballero Negro"] img'), 'la tarjeta muestra la foto de una de sus tallas');
    a.deepStrictEqual(p.errores, []);
  }],
  ['Encargada: ve costos, sin importar, fotos, ajustes ni ofertas', async (env, a) => {
    const p = await env.pagina({ usuario: 'encargada', ruta: '/inventario' });
    await p.click('.grupo-inv[data-nombre="Jogger Texcol Caballero Negro"]');
    a.ok((await texto(p, '.capa')).includes('Costo'));
    for (const b of ['Sincronizar inventario', 'Fotos', 'Ajustar', 'Oferta']) a.strictEqual(await p.$(`button:has-text("${b}")`), null, b);
  }],
  ['Detalle de una prenda: los precios salen una sola vez si son iguales en todas las tallas', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/inventario' });
    await p.click('.grupo-inv[data-nombre="Franela AS Niño Manga Corta Blanco"]');
    await p.waitForSelector('.detalle-grupo');
    a.strictEqual(await p.$$eval('.detalle-grupo .precio-tramo:not(.costo)', e => e.length), 5);
    a.strictEqual(await p.$$eval('.detalle-grupo .talla-fila', e => e.length), 4);
    // Sin precio propio, el tramo 48+ muestra el que se cobra (el de 24–47), nunca «—»
    a.deepStrictEqual(await p.$$eval('.detalle-grupo .precio-tramo:not(.costo) b', e => e.map(x => x.textContent)), ['25.000', '24.000', '22.500', '20.000', '20.000']);
  }],
  ['La tarjeta del inventario no lista tallas: total, estado y cuántas tallas', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/inventario' });
    const t = await texto(p, '.grupo-inv[data-nombre="Buzo Etanol Caballero Gris"]');
    a.ok(/3 tallas/.test(t) && /Stock bajo/.test(t), t);
    a.strictEqual(await p.$('.grupo-inv .mini-tallas'), null);
    a.strictEqual(await p.$$eval('.grupo-inv[data-nombre="Buzo Etanol Caballero Gris"] .gi-salud i', e => e.length), 3);
  }],
  ['El historial muestra la existencia inicial', async (env, a) => {
    const p = await env.pagina({ ruta: '/inventario' });
    await p.click('.grupo-inv[data-nombre="Franela AS Niño Manga Corta Blanco"]');
    await p.click('.talla-fila[data-sku="F-B-4"] button:has-text("Historial")');
    await p.waitForSelector('.mov');
    a.match(await p.innerText('.capa:last-of-type'), /Existencia inicial/);
  }],
  ['Inventario sin tarjetas de valor arriba', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, ruta: '/inventario' });
    await p.waitForSelector('.grupo-inv');
    a.strictEqual(await p.$('.valor-inv, .vista .tile'), null);
  }],
]);
