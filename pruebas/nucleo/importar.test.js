import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerInventario, planImportacion } from '../../js/nucleo/importar.js';

const INV = JSON.parse(readFileSync(new URL('./ejemplos/inventario.json', import.meta.url)));

test('lee la fila real de App-Inventario (Franela AS Niño 4 Blanco)', () => {
  const { productos, avisos } = leerInventario(INV);
  const p = productos[0];
  assert.equal(productos.length, 3);
  assert.equal(p.sku, 'Fran-AS-Niño-4-Bla-Alg');
  assert.equal(p.nombre, 'Franela AS Niño 4 Blanco Algodon');
  assert.deepEqual(p.precios, [25000, 24000, 22500, 20000, null]);
  assert.equal(p.existencia, 12);
  assert.equal(p.minimo, 5);
  assert.equal(p.costo, 9000);
  assert.equal(p.codigo, '100983086933'); // la columna sin título que sigue a barcode
  assert.equal(p.categoria, 'Niño');
  assert.equal(p.marca, 'AS');
  assert.equal(p.separado, false);
  assert.deepEqual(p.comisiones[0], { tipo: 'Fijo', valor: 4000, reducida: 2000 });
  assert.equal(p.comisiones[4], null);
  assert.equal(p.grupo, 'Franela AS Niño 4 Blanco Algodon'); // sin producto/color aún: agrupa por nombre
  assert.ok(avisos.some(a => /producto, color y talla/.test(a)));
});

test('con los campos nuevos de la Carga Masiva agrupa por producto y color', () => {
  const head = [...INV.head, 'price5', 'separado', 'producto', 'color', 'talla'];
  const rows = INV.rows.map((r, i) => [...r, '19000', true, 'Franela AS Niño', 'Blanco', ['4', '6', '8'][i]]);
  const { productos, avisos } = leerInventario({ ...INV, head, rows });
  assert.deepEqual(productos[0].precios, [25000, 24000, 22500, 20000, 19000]);
  assert.equal(productos[0].grupo, 'Franela AS Niño Blanco');
  assert.equal(productos[1].talla, '6');
  assert.equal(productos[0].separado, true);
  assert.deepEqual(avisos, []);
});

test('un costo vacío queda como desconocido, no como 0 (revisión)', () => {
  const head = INV.head, i = head.indexOf('cost');
  const rows = INV.rows.map(r => r.map((v, k) => k === i ? '' : v));
  assert.equal(leerInventario({ ...INV, rows }).productos[0].costo, null);
});

test('el costo se compara contra costos/{sku}, no contra el producto (revisión)', () => {
  const { productos } = leerInventario(INV);
  const actuales = Object.fromEntries(productos.map(({ costo, ...p }) => [p.sku, p]));
  const costos = Object.fromEntries(productos.map(p => [p.sku, { costo: 9000 }]));
  const plan = planImportacion(productos, actuales, costos);
  assert.equal(plan.iguales.length, 3);
  const plan2 = planImportacion([{ ...productos[0], costo: 9500 }], actuales, costos);
  assert.deepEqual(plan2.cambios, [{ sku: productos[0].sku, campos: { costo: 9500 } }]);
});

test('el plan nunca toca la existencia de productos que ya existen', () => {
  const { productos } = leerInventario(INV);
  const [a, b, c] = productos;
  const actuales = { [a.sku]: { ...a, existencia: 3 }, [b.sku]: { ...b, existencia: 1 }, viejo: { sku: 'viejo', activo: true } };
  const plan = planImportacion([{ ...a, existencia: 99, precios: [26000, 24000, 22500, 20000, null] }, b, c], actuales, { [a.sku]: { costo: 9000 }, [b.sku]: { costo: 9000 } });
  assert.deepEqual(plan.nuevos.map(p => p.sku), [c.sku]);
  assert.equal(plan.cambios.length, 1);
  assert.deepEqual(Object.keys(plan.cambios[0].campos), ['precios']);
  assert.ok(!('existencia' in plan.cambios[0].campos));
  assert.deepEqual(plan.iguales, [b.sku]);
  assert.deepEqual(plan.faltantes, ['viejo']);
});
