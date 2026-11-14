import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerInventario, planImportacion, detalleCambios, claveGrupo, tituloProducto } from '../../js/nucleo/importar.js';

// Tres filas reales del inventario.json de la Carga Masiva (columnas en español).
const INV = JSON.parse(readFileSync(new URL('./ejemplos/inventario.json', import.meta.url)));
const conFilas = (rows, head = INV.head) => ({ ...INV, head, rows });
const col = c => INV.head.indexOf(c);
const cambiar = (fila, c, v) => fila.map((x, k) => (k === col(c) ? v : x));

test('lee la fila real (Franela AS Niño 4 Blanco Algodón) por nombre de columna', () => {
  const { productos, errores, avisos, filas } = leerInventario(INV);
  assert.equal(filas, 3); assert.equal(productos.length, 3); assert.deepEqual(errores, []); assert.deepEqual(avisos, []);
  const p = productos[0];
  assert.equal(p.sku, 'Fran-AS-Niño-4-Bla-Alg');
  assert.equal(p.nombre, 'Franela AS Niño 4 Blanco Algodon');
  assert.deepEqual([p.tipo, p.tela, p.color, p.talla, p.genero, p.marca, p.modelo], ['Franela', 'Algodon', 'Blanco', '4', 'Niño', 'AS', 'Manga Corta']);
  assert.deepEqual(p.precios, [25000, 24000, 22500, 20000, 18000]);
  assert.equal(p.costo, 9000); assert.equal(p.existencia, 12); assert.equal(p.minimo, 5);
  assert.equal(p.codigo, '1009830869336'); assert.equal(typeof p.codigo, 'string');
  assert.equal(p.separado, false);
  assert.equal(p.titulo, 'Franela AS Niño');
  assert.equal(p.grupo, claveGrupo(p));
  assert.equal('categoria' in p || 'producto' in p || 'comisiones' in p, false, 'sin campos viejos');
});

test('las tallas de un mismo tipo, tela, marca, género, modelo y color forman una sola tarjeta', () => {
  const { productos } = leerInventario(INV);
  assert.equal(new Set(productos.map(p => p.grupo)).size, 1);
  assert.deepEqual(productos.map(p => p.talla), ['4', '6', '8']);
  const otra = { ...productos[0], tela: 'PoliAlg.' };
  assert.notEqual(claveGrupo(otra), productos[0].grupo, 'otra tela es otra tarjeta');
});

test('lee por nombre: columnas en otro orden y columnas desconocidas no lo rompen', () => {
  const orden = [...INV.head].reverse().concat(['columna_nueva']);
  const rows = INV.rows.map(r => [...r].reverse().concat(['x']));
  const { productos, errores } = leerInventario(conFilas(rows, orden));
  assert.deepEqual(errores, []);
  assert.equal(productos[0].sku, 'Fran-AS-Niño-4-Bla-Alg');
  assert.deepEqual(productos[0].precios, [25000, 24000, 22500, 20000, 18000]);
});

test('conserva los ceros a la izquierda del código y lee números escritos como texto', () => {
  const rows = [cambiar(cambiar(INV.rows[0], 'codigo', '0012345678905'), 'costo', '9.500,5'.replace('.', ''))];
  const p = leerInventario(conFilas(rows)).productos[0];
  assert.equal(p.codigo, '0012345678905');
  assert.equal(p.costo, 9500.5);
});

test('valida y reporta filas con error sin detener la importación', () => {
  const [a, b, c] = INV.rows;
  const rows = [a, cambiar(b, 'sku', ''), cambiar(c, 'codigo', '12345'), a, cambiar(c, 'costo', 'abc'), cambiar(cambiar(c, 'sku', 'Otro'), 'existencia', '-2'), cambiar(cambiar(c, 'sku', 'X'), 'precio1', '')];
  const { productos, errores } = leerInventario(conFilas(rows));
  assert.equal(productos.length, 1);
  assert.deepEqual(errores.map(e => e.fila), [2, 3, 4, 5, 6, 7]);
  assert.match(errores[0].motivo, /Sin sku/);
  assert.match(errores[1].motivo, /13 dígitos/);
  assert.match(errores[2].motivo, /repetido.*fila 1/);
  assert.match(errores[3].motivo, /costo.*no es un número/);
  assert.match(errores[4].motivo, /negativo/);
  assert.match(errores[5].motivo, /precio1/);
});

test('sin la columna sku el archivo no se importa y se dice por qué', () => {
  const head = INV.head.map(h => (h === 'sku' ? 'codigo_viejo' : h));
  const r = leerInventario(conFilas(INV.rows, head));
  assert.equal(r.productos.length, 0);
  assert.match(r.errores[0].motivo, /falta la columna sku/);
});

test('un costo vacío queda como desconocido, no como 0', () => {
  const rows = INV.rows.map(r => cambiar(r, 'costo', ''));
  assert.equal(leerInventario(conFilas(rows)).productos[0].costo, null);
});

test('el costo se compara contra costos/{sku}, no contra el producto', () => {
  const { productos } = leerInventario(INV);
  const actuales = Object.fromEntries(productos.map(({ costo, ...p }) => [p.sku, p]));
  const costos = Object.fromEntries(productos.map(p => [p.sku, { costo: 9000 }]));
  assert.equal(planImportacion(productos, actuales, costos).iguales.length, 3);
  const plan2 = planImportacion([{ ...productos[0], costo: 9500 }], actuales, costos);
  assert.deepEqual(plan2.cambios, [{ sku: productos[0].sku, campos: { costo: 9500 } }]);
});

test('upsert por sku: nuevos, actualizados, sin cambios y los que faltan solo se listan; nunca toca la existencia de los que ya existen', () => {
  const { productos } = leerInventario(INV);
  const [a, b, c] = productos;
  const actuales = { [a.sku]: { ...a, existencia: 3 }, [b.sku]: { ...b, existencia: 1 }, viejo: { sku: 'viejo', activo: true } };
  const plan = planImportacion([{ ...a, existencia: 99, precios: [26000, 24000, 22500, 20000, 18000] }, b, c], actuales, { [a.sku]: { costo: 9000 }, [b.sku]: { costo: 9000 } });
  assert.deepEqual(plan.nuevos.map(p => p.sku), [c.sku]);
  assert.deepEqual(plan.cambios, [{ sku: a.sku, campos: { precios: [26000, 24000, 22500, 20000, 18000] } }]);
  assert.deepEqual(plan.iguales, [b.sku]);
  assert.deepEqual(plan.faltantes, ['viejo']);
  assert.deepEqual(plan.existencias, [{ sku: a.sku, antes: 3, despues: 99 }, { sku: b.sku, antes: 1, despues: 12 }], 'las existencias distintas van aparte');
});

test('detalle de cambios campo por campo («precio1 25000 → 27000»)', () => {
  const actual = { precios: [25000, 24000, 22500, 20000, 18000], minimo: 5, color: 'Blanco', grupo: 'x' };
  const lineas = detalleCambios({ campos: { precios: [27000, 24000, 22500, 20000, null], minimo: 4, grupo: 'y', costo: 9500 } }, actual, 9000);
  assert.deepEqual(lineas, ['precio1 25000 → 27000', 'precio5 18000 → —', 'minimo 5 → 4', 'costo 9000 → 9500']);
});

test('título de la tarjeta: la columna nombre tal cual, sin talla, color ni tela (el modelo no se agrega)', () => {
  const fila = (nombre, talla, color, tela, extra = {}) => ({ nombre, talla, color, tela, tipo: 'X', marca: 'Y', genero: 'Z', modelo: 'Manga Corta', ...extra });
  assert.equal(tituloProducto(fila('Franela Etanol Unisex 2XL Amarillo Claro PoliAlg.', '2XL', 'Amarillo Claro', 'PoliAlg.')), 'Franela Etanol Unisex');
  assert.equal(tituloProducto(fila('Jogger Tubo Etanol Dama M Mostaza', 'M', 'Mostaza', '')), 'Jogger Tubo Etanol Dama', 'si el nombre trae el modelo, se respeta');
  assert.equal(tituloProducto(fila('Blusón Etanol Dama Esmeralda PoliAlg.', '', 'Esmeralda', 'PoliAlg.')), 'Blusón Etanol Dama');
  assert.equal(tituloProducto(fila('Franela AS Niño 4 Blanco Algodon', '4', 'blanco', 'algodón')), 'Franela AS Niño', 'sin importar mayúsculas ni acentos');
  assert.equal(tituloProducto(fila('Sueter ML AS Unisex S Rojo Algodon', 'S', 'Rojo', 'Algodon')), 'Sueter ML AS Unisex', 'quita la talla solo como palabra suelta');
  assert.equal(tituloProducto({ tipo: 'Chemis', marca: 'Texcol', genero: 'Caballero', modelo: 'Chemis' }), 'Chemis Texcol Caballero', 'sin nombre: tipo, marca y género');
  assert.equal(tituloProducto({ sku: 'X' }), 'X');
});

test('lee id_imagen en minúsculas; vacío queda como texto vacío', () => {
  const { productos } = leerInventario(INV);
  assert.match(productos[0].id_imagen, /^img-\d{4}$/);
  assert.equal(new Set(productos.map(p => p.id_imagen)).size, 1, 'las tallas comparten código');
  const raro = leerInventario(conFilas([cambiar(INV.rows[0], 'id_imagen', ' IMG-0099 '), cambiar(INV.rows[1], 'id_imagen', '')])).productos;
  assert.deepEqual(raro.map(p => p.id_imagen), ['img-0099', '']);
});

test('un id_imagen distinto cuenta como cambio en la vista previa', () => {
  const { productos } = leerInventario(INV);
  const actuales = Object.fromEntries(productos.map(p => [p.sku, { ...p, id_imagen: 'img-0500' }]));
  const plan = planImportacion(productos, actuales, {});
  assert.equal(plan.cambios.length, 3);
  assert.ok(detalleCambios(plan.cambios[0], actuales[plan.cambios[0].sku], null).some(t => t.startsWith('id_imagen img-0500 →')));
});
