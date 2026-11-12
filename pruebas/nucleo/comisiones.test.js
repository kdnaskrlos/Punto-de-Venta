import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMISIONES_DEFECTO, comisionLinea, comisionesVenta, resumenComisiones } from '../../js/nucleo/comisiones.js';

const cm = (valor, reducida) => ({ tipo: 'Fijo', valor, reducida });
const P = {
  F: { sku: 'F', comisiones: [cm(4000, 2000), cm(2000, 1000), cm(1000, 500), cm(1000, 500), null] },
  B: { sku: 'B', comisiones: [] },
};

test('comisión fija por prenda, normal y reducida (§14)', () => {
  assert.equal(comisionLinea({ tramo: 0, cantidad: 2, subtotal: 50000 }, { comisiones: [] }, COMISIONES_DEFECTO, false), 8000);
  assert.equal(comisionLinea({ tramo: 0, cantidad: 2, subtotal: 50000 }, { comisiones: [] }, COMISIONES_DEFECTO, true), 4000);
});

test('tramo +49 sin dato usa la del tramo 4', () => {
  assert.equal(comisionLinea({ tramo: 4, cantidad: 1, subtotal: 20000 }, { comisiones: [] }, COMISIONES_DEFECTO, false), 1000);
  assert.equal(comisionLinea({ tramo: 4, cantidad: 2, subtotal: 40000 }, P.F, COMISIONES_DEFECTO, false), 2000);
});

test('comisión en porcentaje del subtotal de la línea', () => {
  assert.equal(comisionLinea({ tramo: 0, cantidad: 1, subtotal: 30000 }, { comisiones: [{ tipo: 'Porcentaje', valor: 10, reducida: 5 }] }, COMISIONES_DEFECTO, false), 3000);
  assert.equal(comisionLinea({ tramo: 0, cantidad: 1, subtotal: 30000 }, { comisiones: [{ tipo: 'Porcentaje', valor: 10, reducida: 5 }] }, COMISIONES_DEFECTO, true), 1500);
});

test('la comisión del producto manda sobre la de ajustes', () => {
  assert.equal(comisionLinea({ tramo: 1, cantidad: 1, subtotal: 24000 }, P.F, [cm(9999, 1), cm(9999, 1)], false), 2000);
});

test('si el producto no tiene dato en ese tramo ni debajo, usa los de ajustes', () => {
  assert.equal(comisionLinea({ tramo: 0, cantidad: 1, subtotal: 25000 }, { comisiones: [null, cm(2000, 1000)] }, COMISIONES_DEFECTO, false), 4000);
});

test('reducida si la línea está en oferta o la venta tiene descuento', () => {
  const lineas = [{ sku: 'F', tramo: 0, cantidad: 1, subtotal: 22500, oferta: true }, { sku: 'B', tramo: 0, cantidad: 1, subtotal: 48000, oferta: false }];
  const cv = comisionesVenta(lineas, P, COMISIONES_DEFECTO, false);
  assert.deepEqual(cv.map(c => c.reducida), [true, false]);
  assert.deepEqual(cv.map(c => c.comision), [2000, 4000]);
  assert.deepEqual(comisionesVenta(lineas, P, COMISIONES_DEFECTO, true).map(c => c.reducida), [true, true]);
});

test('lo pagado se cuenta por las ventas incluidas en el pago, no por el día (revisión final)', () => {
  const v = (id, fecha, comision) => ({ id, usuario: 'ana', fecha, estado: 'ok', lineas: [{ cantidad: 1, comision, reducida: false }] });
  const ventas = [v('a', '2026-11-12T15:00:00Z', 4000), v('b', '2026-11-12T22:00:00Z', 2000)]; // b se vendió después de pagar
  const pagos = [{ vendedor: 'ana', desde: '2026-11-12', hasta: '2026-11-12', monto: 4000, ventas: ['a'] }];
  const r = resumenComisiones(ventas, { vendedor: 'ana', desde: '2026-11-12', hasta: '2026-11-12' }, pagos);
  assert.equal(r.pagado, 4000); assert.equal(r.pendiente, 2000);
  assert.deepEqual(r.idsPendientes, ['b']);
});

test('resumen por vendedora y rango, sin anuladas, con lo pagado', () => {
  const v = (fecha, lineas, estado = 'ok', usuario = 'ana') => ({ usuario, fecha, estado, lineas });
  const ventas = [
    v('2026-11-10T15:00:00Z', [{ cantidad: 2, comision: 8000, reducida: false }, { cantidad: 1, comision: 2000, reducida: true }]),
    v('2026-11-11T15:00:00Z', [{ cantidad: 1, comision: 4000, reducida: false }], 'anulada'),
    v('2026-11-11T16:00:00Z', [{ cantidad: 1, comision: 4000, reducida: false }], 'ok', 'otra'),
    v('2026-11-20T15:00:00Z', [{ cantidad: 1, comision: 4000, reducida: false }]),
  ];
  const pagos = [{ vendedor: 'ana', desde: '2026-11-10', hasta: '2026-11-10', monto: 10000 }];
  const r = resumenComisiones(ventas, { vendedor: 'ana', desde: '2026-11-10', hasta: '2026-11-15' }, pagos);
  assert.deepEqual({ ...r, idsPendientes: undefined }, { ventas: 1, prendas: 3, normal: 8000, reducida: 2000, total: 10000, pagado: 10000, pendiente: 0, idsPendientes: undefined });
  // un pago de todo el mes cubre una consulta de una semana (revisión: no pagar dos veces)
  const mes = [{ vendedor: 'ana', desde: '2026-11-01', hasta: '2026-11-30', monto: 14000 }];
  assert.equal(resumenComisiones(ventas, { vendedor: 'ana', desde: '2026-11-09', hasta: '2026-11-15' }, mes).pendiente, 0);
  assert.equal(resumenComisiones(ventas, { vendedor: 'ana', desde: '2026-11-09', hasta: '2026-11-25' }, pagos).pendiente, 4000);
});
