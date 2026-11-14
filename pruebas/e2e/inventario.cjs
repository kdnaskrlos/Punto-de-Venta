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

// El inventario agrupa por prenda: la tarjeta de la prenda tiene data-skus con sus tallas.
const itemDe = sku => `.stk .tarjeta-prenda[data-skus~="${sku}"]`;
const abrirPrenda = async (p, sku) => { await p.fill('#q', sku); await p.click(itemDe(sku)); await p.waitForFunction(() => document.querySelectorAll('.stk-capa .sheet.in').length === 1); };
// Abre la prenda y luego la talla (segunda hoja, con Historial y Ajustar).
const abrirSku = async (p, sku) => { await abrirPrenda(p, sku); await p.click(`.stk-capa .talla-inv[data-sku="${sku}"]`); await p.waitForFunction(() => document.querySelectorAll('.stk-capa .sheet.in').length === 2); };
const hoja = p => p.evaluate(() => { const hs = document.querySelectorAll('.stk-capa .sheet'); return hs[hs.length - 1].textContent.replace(/\s+/g, ' ').trim(); });
const vis = (p, s) => p.innerText(s).then(t => t.replace(/\s+/g, ' ').trim());

casos('inventario', [
  ['Lista agrupada por prenda: segmentos por prenda, tarjeta con tallas, precio · género · unidades y foto', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 844, ruta: '/inventario' });
    a.strictEqual(await p.$('.stk .brand, #bTheme'), null, 'sin título ni selector de tema');
    a.ok(await p.evaluate(() => document.documentElement.classList.contains('stk-sin-barra')), 'sin barra de desplazamiento');
    a.strictEqual(await p.$('#tiles, .stile'), null, 'sin tarjetas de unidades ni variantes');
    a.deepStrictEqual(await p.evaluate(() => ['.stk .tarjeta-prenda .info b', '.stk .tarjeta-prenda .tp-linea', '.stk .seg b'].map(x => getComputedStyle(document.querySelector(x)).fontFamily.split(',')[0].replace(/"/g, ''))), ['Plus Jakarta Sans', 'Plus Jakarta Sans', 'Plus Jakarta Sans'], 'letra del POS');
    a.strictEqual(await vis(p, '#seg'), '6 Todos 1 Stock bajo 1 Agotados');
    a.strictEqual(await p.$$eval('.stk .tarjeta-prenda', e => e.length), 6);
    const totalJ = await p.evaluate(() => Object.values(window.__pos.ctx.productos).filter(x => x.sku.startsWith('J-')).reduce((n, x) => n + x.existencia, 0));
    // v1.91: la misma tarjeta de Vender (Tarjetas listado): nombre, «color · tela», «N disp.» y precio.
    a.strictEqual(await texto(p, itemDe('J-M') + ' .info b'), 'Jogger Texcol Caballero');
    a.strictEqual(await texto(p, itemDe('J-M') + ' .tp-color'), 'Negro');
    a.strictEqual(await texto(p, itemDe('J-M') + ' .tp-disp'), `${totalJ} disp.`);
    a.strictEqual(await texto(p, itemDe('J-M') + ' .precio'), '42.000');
    a.ok(await p.$(itemDe('B-L') + ' .tp-disp.y'), 'pastilla de stock bajo');
    a.ok(await p.$(itemDe('R-M') + '.agotada .est.r'), 'pastilla de agotado');
    a.strictEqual(await p.$('.stk .en-carrito'), null, 'sin círculo del carrito');
    a.strictEqual(await p.$('#seg [data-st], #meta'), null, 'tarjetas solo informativas y sin línea de conteo');
    a.ok(await p.$(itemDe('J-M') + ' .foto svg'), 'sin foto: recuadro con ícono');
    a.strictEqual(await texto(p, '#fSt'), 'Stock');
    await p.click('#fSt'); await p.click('.menu-it:has-text("Agotados")');
    a.deepStrictEqual(await p.$$eval('.stk .tarjeta-prenda', e => e.map(x => x.dataset.skus)), ['R-M R-L']);
    await p.click('#fSt'); await p.click('.menu-it:has-text("Todos")');
    await p.click('#fCat'); await p.click('.menu-it:has-text("Dama")');
    a.strictEqual(await p.$$eval('.stk .tarjeta-prenda', e => e.length), 1);
    await p.click('#fCat'); await p.click('.menu-it >> nth=0');
    await p.fill('#q', 'zzzz'); await p.waitForSelector('text=Nada coincide con esos filtros.');
    await p.evaluate(() => { location.hash = '/inicio'; });
    await p.waitForFunction(() => !document.documentElement.classList.contains('stk-sin-barra'));
    a.deepStrictEqual(p.errores, []);
  }],
  ['Detalle: la prenda con sus tallas y, al tocar una, su hoja con stock, precios y ficha; Atrás cierra de a una sin salir del inventario', async (env, a) => {
    const p = await env.pagina({ ancho: 390, alto: 844, usuario: 'vendedora', ruta: '/inventario' });
    await abrirSku(p, 'J-M');
    const t = await hoja(p);
    for (const x of ['Jogger Texcol Caballero M Negro', 'J-M', 'Stock', '5', 'en total', 'Precio 1', '42.000', 'Precio 5', '34.000', 'Tipo', 'Jogger', 'Talla', 'M']) a.ok(t.includes(x), `falta ${x}: ${t}`);
    a.ok(!t.includes('Costo'), 'la vendedora no ve costos');
    a.ok(!/Código de barras|Copiar/.test(t), 'sin código de barras ni botones de copiar');
    a.strictEqual(await p.$('#det-acciones:not([hidden])'), null, 'sin acciones');
    a.ok(await p.evaluate(() => document.body.classList.contains('stk-lock')), 'el fondo no hace scroll');
    await p.goBack();
    await p.waitForFunction(() => document.querySelectorAll('.stk-capa .sheet').length === 1, null, { timeout: 3000 });
    a.match(await hoja(p), /Tallas.*Talla S/, 'Atrás vuelve a la prenda');
    await p.goBack();
    await p.waitForSelector('.stk-capa', { state: 'detached' });
    a.strictEqual(await p.evaluate(() => location.hash), '#/inventario');
    a.deepStrictEqual(p.errores, []);
  }],
  ['Escáner: el código escrito abre la tarjeta del producto; uno que no existe avisa', async (env, a) => {
    const p = await env.pagina({ ruta: '/inventario' });
    const codigo = await p.evaluate(() => window.__pos.ctx.productos['B-M'].codigo);
    await p.click('#bScan');
    await p.waitForSelector('.stk-capa.escaner #manualQ');
    await p.waitForFunction(() => /Escribe el código/.test(document.querySelector('#scanMsg')?.textContent || ''));
    await p.fill('#manualQ', '0000000000000'); await p.click('#manual button');
    a.strictEqual(await texto(p, '#scanMsg'), 'No encontré ese código');
    await p.fill('#manualQ', codigo); await p.click('#manual button');
    await p.waitForSelector('.stk-capa.escaner', { state: 'detached' });
    await p.waitForSelector('.stk-capa .sheet.in');
    a.match(await hoja(p), /Buzo Etanol Caballero M Gris/);
    await p.keyboard.press('Escape');
    await p.waitForSelector('.stk-capa', { state: 'detached' });
    await p.fill('#q', codigo); await p.press('#q', 'Enter');
    await p.waitForSelector('.stk-capa .sheet.in');
    a.deepStrictEqual(p.errores, []);
  }],
  ['Admin: sincronizar muestra la vista previa y solo guarda al aplicar; la existencia de los que ya existen no se pisa', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    await servirInventario(p, INV);
    a.doesNotMatch(await p.getAttribute('#bSync', 'title') || '', /Última sincronización: \d/);
    await p.click('#bSync');
    await p.waitForFunction(() => document.querySelector('.resumen-imp.g')?.innerText.replace(/\s+/g, ' ').trim() === '3 nuevos');
    a.match(await texto(p, '.sinc-fecha'), /Archivo del .*· 3 filas/);
    a.strictEqual(await p.evaluate(() => !!window.__pos.ctx.productos['Fran-AS-Niño-4-Bla-Alg']), false, 'nada se guarda antes de aplicar');
    await p.click('#sinc-cancelar');
    a.strictEqual(await p.evaluate(() => !!window.__pos.ctx.productos['Fran-AS-Niño-4-Bla-Alg']), false, 'cancelar no guarda');
    await p.click('#bSync');
    await p.click('#sinc-aplicar');
    await p.waitForSelector('text=Inventario sincronizado');
    a.strictEqual(await existencia(p, 'Fran-AS-Niño-4-Bla-Alg'), 12);
    await p.waitForFunction(() => /Última sincronización: .*\d/.test(document.querySelector('#bSync').title));
    await p.evaluate(() => { window.__pos.ctx.almacen._estado('productos').get('Fran-AS-Niño-4-Bla-Alg').existencia = 3; });
    const cambiado = JSON.parse(JSON.stringify(INV));
    cambiado.rows[0][cambiado.head.indexOf('precio1')] = '27000';
    cambiado.rows[0][cambiado.head.indexOf('minimo')] = '4';
    await p.unroute(/App-Inventario/); await servirInventario(p, cambiado);
    await p.click('#bSync');
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
    await p.click('#bSync'); await p.click('#sinc-aplicar'); await p.waitForSelector('text=Inventario sincronizado');
    await p.evaluate(() => window.__pos.ctx.almacen.ajustarExistencia('Fran-AS-Niño-4-Bla-Alg', -9, 'Venta', 'prueba'));
    await p.waitForFunction(() => window.__pos.ctx.productos['Fran-AS-Niño-4-Bla-Alg'].existencia === 3);
    await p.click('#bSync');
    await p.waitForSelector('#sinc-existencia');
    await p.waitForFunction(() => [...document.querySelectorAll('.sinc-check')].some(e => /1 producto que ya existe tiene otra existencia/.test(e.textContent)));
    await p.check('#sinc-existencia');
    await p.click('#sinc-aplicar'); await p.waitForSelector('text=Inventario sincronizado');
    a.strictEqual(await existencia(p, 'Fran-AS-Niño-4-Bla-Alg'), 12);
  }],
  ['Sin internet o archivo dañado: mensaje claro y no cambia nada', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    await p.route(/App-Inventario\/data\/inventario\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{roto' }));
    await p.click('#bSync');
    await p.waitForSelector('text=no es un inventario válido');
    a.ok(await p.isDisabled('#sinc-aplicar'));
    await p.click('#sinc-cancelar');
    await p.unroute(/App-Inventario/);
    await p.route(/App-Inventario\/data\/inventario\.json/, r => r.abort());
    await p.click('#bSync');
    await p.waitForSelector('text=No se cambió nada en el punto de venta');
    await p.waitForSelector('text=Sin conexión');
  }],
  ['Admin: ajuste +3 "Llegó del taller" desde la tarjeta de detalle, queda en el historial y la tarjeta se actualiza', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    await abrirSku(p, 'J-M');
    await p.click('#det-ajustar');
    await p.fill('#ajuste-cantidad', '3');
    await p.selectOption('#ajuste-motivo', 'Llegó del taller');
    await p.click('#ajuste-final');
    await p.waitForFunction(() => window.__pos.ctx.productos['J-M'].existencia === 8);
    await p.waitForFunction(() => { const hs = document.querySelectorAll('.stk-capa .sheet'); return hs[hs.length - 1].querySelector('.big .stk b')?.textContent === '8'; });
    await p.click('#det-historial');
    await p.waitForSelector('.mov');
    a.ok((await texto(p, '.capa:last-of-type')).includes('Llegó del taller'));
  }],
  ['Admin: oferta del 10% cambia el precio en Vender', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', caja: true, ruta: '/inventario' });
    await abrirPrenda(p, 'J-M');
    await p.click('#det-oferta');
    await p.fill('#oferta-pct', '10');
    await p.click('#oferta-final');
    await p.waitForFunction(() => window.__pos.ctx.productos['J-M'].oferta?.activa === true);
    await p.waitForSelector('.stk-capa .oferta');
    await p.keyboard.press('Escape');
    await p.waitForSelector('.stk-capa', { state: 'detached' });
    await p.evaluate(() => { location.hash = '/vender'; });
    await p.waitForSelector('.tarjeta-prenda[data-nombre="Jogger Texcol Caballero Negro"] .tp-estado');
    await p.evaluate(() => { const c = window.__pos.ctx; c.carrito = { lineas: [{ sku: 'J-M', cantidad: 1 }] }; window.dispatchEvent(new CustomEvent('pos:carrito')); });
    a.strictEqual(await texto(p, '.carrito .total-cop'), '37.800');
  }],
  ['Admin: una foto por código de imagen la muestran todas sus variantes, sin copiarla a cada sku', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#888' } }).png().toBuffer();
    await p.click('#bData');
    a.strictEqual(await texto(p, '#fotos-resumen'), '0 de 21 productos con foto · 5 códigos de imagen sin foto');
    await p.setInputFiles('#fotos-archivos', [{ name: 'IMG-0001.jpg', mimeType: 'image/png', buffer: png }]);
    a.strictEqual(await texto(p, '#fotos-asignadas'), '1 foto asignada a 4 productos · 0 sin asignar');
    await p.click('#fotos-final');
    await p.waitForSelector('text=1 foto subida · 4 de 21 productos con foto · 4 códigos de imagen sin foto');
    const estado = await p.evaluate(() => { const c = window.__pos.ctx; return { img: !!c.imagenes['img-0001'], fotosSku: Object.values(c.productos).filter(x => x.foto).length }; });
    a.deepStrictEqual(estado, { img: true, fotosSku: 0 }, 'la foto queda en el código');
    a.strictEqual(await p.$$eval('.stk .tarjeta-prenda .foto img', e => e.length), 1, 'la prenda de img-0001 muestra la foto');
    a.ok(await p.$(itemDe('F-B-8') + ' .foto img'));
    a.strictEqual(await p.$(itemDe('F-N-8') + ' .foto img'), null, 'otro código sigue sin foto');
    await abrirSku(p, 'F-B-8');
    a.strictEqual(await p.$$eval('.stk-capa .fotocard img', e => e.length), 2, 'la prenda y la talla muestran la foto arriba');
    await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForSelector('.stk-capa', { state: 'detached' });
    await p.evaluate(() => { location.hash = '/vender'; });
    await p.waitForSelector('.tarjeta-prenda[data-nombre="Franela AS Niño Blanco"] img');
    a.deepStrictEqual(p.errores, []);
  }],
  ['Admin: «Subir foto» en la tarjeta de detalle sube la foto a su código de imagen', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#888' } }).png().toBuffer();
    await abrirPrenda(p, 'B-M');
    a.match(await hoja(p), /Código de imagen\s*img-0003/);
    a.strictEqual(await p.$('.stk-capa .fotocard'), null, 'sin foto no hay tarjeta de foto');
    await p.setInputFiles('#foto-codigo-archivo', { name: 'cualquiera.png', mimeType: 'image/png', buffer: png });
    await p.waitForSelector('text=Foto guardada para img-0003');
    await p.waitForSelector('.stk-capa .fotocard img');
    a.strictEqual(await texto(p, '#foto-codigo'), 'Cambiar foto');
    a.ok(await p.evaluate(() => !!window.__pos.ctx.imagenes['img-0003']), 'registro');
    a.deepStrictEqual(p.errores, []);
  }],
  ['Fotos: la nota siempre pide el código de imagen; sin códigos avisa que hay que sincronizar', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    await p.click('#bData');
    a.match(await texto(p, '.zona-fotos .nota'), /código de imagen, por ejemplo img-0001\.jpg/);
    a.strictEqual(await p.$('#fotos-sin-codigos'), null);
    await p.keyboard.press('Escape');
    await p.evaluate(() => { for (const x of Object.values(window.__pos.ctx.productos)) x.id_imagen = ''; });
    await p.click('#bData');
    a.match(await texto(p, '#fotos-sin-codigos'), /Sincronizar inventario/);
  }],
  ['Admin: un archivo con nombre de sku ya no se asigna (sin respaldo por sku)', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#888' } }).png().toBuffer();
    await p.click('#bData');
    await p.setInputFiles('#fotos-archivos', [{ name: 'j-m.png', mimeType: 'image/png', buffer: png }]);
    a.strictEqual(await texto(p, '#fotos-asignadas'), '0 fotos asignadas a 0 productos · 1 sin asignar');
    const opciones = await p.$$eval('.sin-asignar option', os => os.map(o => o.value));
    a.ok(opciones.slice(1).every(v => /^img-\d{4}$/.test(v)), 'solo se elige entre códigos de imagen');
  }],
  ['Detalle de un producto sin código de imagen: no ofrece subir foto', async (env, a) => {
    const p = await env.pagina({ usuario: 'admin', ruta: '/inventario' });
    await abrirSku(p, 'R-M');
    a.strictEqual(await p.$('#foto-codigo'), null);
    a.ok(await p.$('#det-ajustar'));
  }],
  ['Encargada: ve el costo con «Mostrar», sin sincronizar, fotos, ajustes ni ofertas', async (env, a) => {
    const p = await env.pagina({ usuario: 'encargada', ruta: '/inventario' });
    for (const b of ['#bSync', '#bData']) a.strictEqual(await p.$(b), null, b);
    await abrirSku(p, 'J-M');
    await p.evaluate(() => { const hs = document.querySelectorAll('.stk-capa .sheet'); hs[hs.length - 1].querySelector('.reveal').click(); });
    a.match(await hoja(p), /Costo\s*17\.000/);
    for (const b of ['#det-ajustar', '#det-oferta', '#foto-codigo']) a.strictEqual(await p.$(b), null, b);
    a.ok(await p.$('#det-historial'));
  }],
  ['El historial muestra la existencia inicial', async (env, a) => {
    const p = await env.pagina({ ruta: '/inventario' });
    await abrirSku(p, 'F-B-4');
    await p.click('#det-historial');
    await p.waitForSelector('.mov');
    a.match(await p.innerText('.capa:last-of-type'), /Existencia inicial/);
  }],
  ['Escritorio: tarjetas en varias columnas, a todo el ancho, con Fotos y Sincronizar en la cabecera', async (env, a) => {
    const p = await env.pagina({ ancho: 1280, alto: 860, usuario: 'admin', ruta: '/inventario' });
    const cols = await p.$$eval('.stk .tarjeta-prenda', e => new Set(e.slice(0, 6).map(x => Math.round(x.getBoundingClientRect().left))).size);
    a.ok(cols >= 3, `columnas: ${cols}`);
    const { izq, der } = await p.$eval('.stk .wrap', w => { const r = w.getBoundingClientRect(); return { izq: r.left - document.querySelector('.vista').getBoundingClientRect().left, der: innerWidth - r.right }; });
    a.deepStrictEqual({ izq, der }, { izq: 16, der: 16 }, 'todo el ancho con 16 px de borde, como las demás pantallas');
    await p.waitForTimeout(400); // termina la animación de entrada de la pantalla
    a.strictEqual(await p.$eval('.stk .seg', e => Math.round(e.getBoundingClientRect().top)), await p.$eval('.topbar', e => Math.round(e.getBoundingClientRect().bottom)) + 16, 'mismo espacio arriba que las demás pantallas');
    a.ok(await p.isVisible('.stk .adm #bSync') && await p.isVisible('.stk .adm #bData'));
  }],
  ['Teléfono angosto (320 px) con muchas prendas: centrado, nada se sale por la derecha', async (env, a) => {
    const p = await env.pagina({ ancho: 320, alto: 658, ruta: '/inventario' });
    await p.evaluate(() => { const c = window.__pos.ctx, base = c.productos['J-M']; for (let i = 0; i < 1400; i++) c.productos['X-' + i] = { ...base, sku: 'X-' + i, color: 'Color ' + i, grupo: undefined }; window.dispatchEvent(new CustomEvent('pos:datos', { detail: { que: 'productos' } })); });
    await p.waitForFunction(() => /1\.406/.test(document.querySelector('#seg').textContent));
    const r = await p.evaluate(() => { const x = document.querySelector('.stk .wrap').getBoundingClientRect(); return { izq: Math.round(x.left), der: Math.round(innerWidth - x.right), sobra: document.querySelector('.vista').scrollWidth - document.querySelector('.vista').clientWidth }; });
    a.deepStrictEqual(r, { izq: 12, der: 12, sobra: 0 });
  }],
  ['Paginación: muestra 80 y luego «Mostrar N más»', async (env, a) => {
    const p = await env.pagina({ ruta: '/inventario' });
    await p.evaluate(() => { const c = window.__pos.ctx, base = c.productos['J-M']; for (let i = 0; i < 100; i++) c.productos['X-' + i] = { ...base, sku: 'X-' + i, color: 'Color ' + i, grupo: undefined }; window.dispatchEvent(new CustomEvent('pos:datos', { detail: { que: 'productos' } })); });
    await p.waitForFunction(() => document.querySelectorAll('.stk .tarjeta-prenda').length === 80);
    a.strictEqual(await texto(p, '#more'), 'Mostrar 26 más');
    await p.click('#more');
    a.strictEqual(await p.$$eval('.stk .tarjeta-prenda', e => e.length), 106);
    a.ok(await p.isHidden('#more'));
  }],
]);
