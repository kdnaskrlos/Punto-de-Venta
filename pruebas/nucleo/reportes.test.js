import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenDia, masVendidos, inventarioBajo, valorInventario } from '../../js/nucleo/reportes.js';

const ventas = [
  { id: 'v1', estado: 'ok', total: 100000, lineas: [{ sku: 'F4', cantidad: 2 }, { sku: 'B', cantidad: 1 }], pagos: [{ forma: 'efectivo-cop', monto: 120000 }], vuelto: { moneda: 'COP', monto: 20000, forma: 'efectivo-cop' } },
  { id: 'v2', estado: 'ok', total: 50000, lineas: [{ sku: 'F6', cantidad: 2 }], pagos: [{ forma: 'pago-movil', monto: 13782.05 }], vuelto: null },
  { id: 'v3', estado: 'anulada', total: 999999, lineas: [{ sku: 'B', cantidad: 9 }], pagos: [{ forma: 'efectivo-cop', monto: 999999 }], vuelto: null },
];
const productos = {
  F4: { sku: 'F4', grupo: 'Franela Blanco', talla: '4', existencia: 3, minimo: 5, precios: [25000], activo: true },
  F6: { sku: 'F6', grupo: 'Franela Blanco', talla: '6', existencia: 10, minimo: 5, precios: [25000], activo: true },
  B: { sku: 'B', grupo: 'Buzo Gris', talla: 'M', existencia: -1, minimo: 2, precios: [48000], activo: true },
};

test('resumen del día sin anuladas, con ganancia si hay costos', () => {
  const r = resumenDia(ventas, { v1: { total: 38000 }, v2: { total: 18000 } });
  assert.deepEqual(r, { ventas: 2, total: 150000, ganancia: 94000, unidades: 5, ticketPromedio: 75000, porForma: { 'efectivo-cop': 100000, 'pago-movil': 13782.05 }, gananciaParcial: false });
  assert.equal(resumenDia(ventas, null).ganancia, null);
  assert.equal(resumenDia(ventas, { v1: { total: 38000 } }).gananciaParcial, true);
  assert.equal(resumenDia([], null).ticketPromedio, 0);
});

test('más vendidos por grupo, con tallas', () => {
  assert.deepEqual(masVendidos(ventas, productos, 5), [
    { grupo: 'Franela Blanco', unidades: 4, tallas: { 4: 2, 6: 2 } },
    { grupo: 'Buzo Gris', unidades: 1, tallas: { M: 1 } },
  ]);
});

test('existencias bajas e inventario valorizado', () => {
  assert.deepEqual(inventarioBajo(Object.values(productos)).map(p => p.sku), ['B', 'F4']);
  assert.deepEqual(valorInventario(Object.values(productos), { F4: { costo: 9000 }, F6: { costo: 9000 }, B: { costo: 20000 } }), { aCosto: 13 * 9000, aPrecio: 13 * 25000 });
});

import { ventasPorPeriodo, cobrosEnPesos } from '../../js/nucleo/reportes.js';

test('ventasPorPeriodo: un solo día se reparte por hora (hora de Venezuela) y omite anuladas', () => {
  const vs = [
    { estado: 'ok', total: 30000, fecha: '2026-11-12T14:10:00.000Z' }, // 10 am
    { estado: 'ok', total: 20000, fecha: '2026-11-12T14:50:00.000Z' }, // 10 am
    { estado: 'ok', total: 50000, fecha: '2026-11-12T19:05:00.000Z' }, // 3 pm
    { estado: 'anulada', total: 99999, fecha: '2026-11-12T16:00:00.000Z' },
  ];
  const r = ventasPorPeriodo(vs, '2026-11-12', '2026-11-12');
  assert.equal(r.modo, 'hora');
  assert.deepEqual(r.barras.find(b => b.clave === 10), { clave: 10, etiqueta: '10a', total: 50000 });
  assert.equal(r.barras.find(b => b.clave === 15).total, 50000);
  assert.equal(r.barras.reduce((s, b) => s + b.total, 0), 100000);
  assert.ok(r.barras[0].clave <= 8 && r.barras.at(-1).clave >= 19, 'cubre el horario de la tienda');
});

test('ventasPorPeriodo: varios días da una barra por día, incluso los días sin ventas', () => {
  const vs = [
    { estado: 'ok', total: 10000, fecha: '2026-11-10T15:00:00.000Z' },
    { estado: 'ok', total: 5000, fecha: '2026-11-13T03:30:00.000Z' }, // 12 nov 11:30 pm en Venezuela
  ];
  const r = ventasPorPeriodo(vs, '2026-11-09', '2026-11-12');
  assert.equal(r.modo, 'dia');
  assert.deepEqual(r.barras.map(b => [b.clave, b.total]), [['2026-11-09', 0], ['2026-11-10', 10000], ['2026-11-11', 0], ['2026-11-12', 5000]]);
});

test('cobrosEnPesos: suma el equivalente en COP por forma, resta el vuelto y omite anuladas', () => {
  const vs = [
    { estado: 'ok', pagos: [{ forma: 'efectivo-usd', monto: 20, equivalenteCop: 78000 }], vuelto: { forma: 'efectivo-cop', moneda: 'COP', monto: 8000 } },
    { estado: 'ok', pagos: [{ forma: 'nequi', monto: 50000, equivalenteCop: 50000 }], vuelto: null },
    { estado: 'anulada', pagos: [{ forma: 'nequi', monto: 1, equivalenteCop: 999 }] },
  ];
  assert.deepEqual(cobrosEnPesos(vs), { 'efectivo-usd': 78000, 'efectivo-cop': -8000, nequi: 50000 });
});
