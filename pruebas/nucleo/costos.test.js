import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costoEn, costoVenta } from '../../js/nucleo/costos.js';

const h = [{ costo: 9500, desde: '2026-11-20T00:00:00Z' }, { costo: 9000, desde: '2026-11-01T00:00:00Z' }];

test('costo vigente en la fecha de la venta (§15)', () => {
  assert.equal(costoEn(h, '2026-11-12T15:00:00Z'), 9000);
  assert.equal(costoEn(h, '2026-11-21T00:00:00Z'), 9500);
  assert.equal(costoEn(h, '2026-11-20T00:00:00Z'), 9500);
  assert.equal(costoEn(h, '2026-10-01T00:00:00Z'), 9000); // antes del primero: el más antiguo
  assert.equal(costoEn([], '2026-11-12T00:00:00Z'), null);
  assert.equal(costoEn(undefined, '2026-11-12T00:00:00Z'), null);
});

test('costo de una venta por línea y total', () => {
  const venta = { fecha: '2026-11-12T15:00:00Z', lineas: [{ sku: 'F', cantidad: 2 }, { sku: 'B', cantidad: 1 }, { sku: 'X', cantidad: 1 }] };
  const costos = { F: { costo: 9500, historial: h }, B: { costo: 20000, historial: [{ costo: 20000, desde: '2026-11-01T00:00:00Z' }] } };
  assert.deepEqual(costoVenta(venta, costos), {
    lineas: [{ sku: 'F', costoUnit: 9000 }, { sku: 'B', costoUnit: 20000 }, { sku: 'X', costoUnit: null }],
    total: 38000, incompleto: true,
  });
});
