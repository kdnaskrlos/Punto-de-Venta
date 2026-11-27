import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarDescuento, repartirDescuento, requiereAutorizacion } from '../../js/nucleo/descuento.js';

test('descuento en porcentaje o monto', () => {
  assert.deepEqual(aplicarDescuento(100000, { tipo: 'pct', valor: 5 }), { descuento: 5000, total: 95000 });
  assert.deepEqual(aplicarDescuento(100000, { tipo: 'monto', valor: 3000 }), { descuento: 3000, total: 97000 });
  assert.deepEqual(aplicarDescuento(100000, null), { descuento: 0, total: 100000 });
  assert.deepEqual(aplicarDescuento(1000, { tipo: 'monto', valor: 5000 }), { descuento: 1000, total: 0 });
  assert.deepEqual(aplicarDescuento(1000, { tipo: 'pct', valor: -5 }), { descuento: 0, total: 1000 });
});

test('reparto proporcional que suma exacto', () => {
  assert.deepEqual(repartirDescuento([{ subtotal: 75000 }, { subtotal: 25000 }], 5001), [3751, 1250]);
  assert.deepEqual(repartirDescuento([{ subtotal: 10000 }, { subtotal: 10000 }, { subtotal: 10000 }], 1000), [334, 333, 333]);
  assert.deepEqual(repartirDescuento([], 1000), []);
});

test('autorización: solo la vendedora por encima del máximo', () => {
  assert.ok(requiereAutorizacion('vendedora', 6, 5));
  assert.ok(!requiereAutorizacion('vendedora', 5, 5));
  assert.ok(!requiereAutorizacion('encargada', 30, 5));
  assert.ok(!requiereAutorizacion('admin', 50, 5));
});

test('v2.09 · el descuento no se reparte a prendas «separado» (subtotal 0 en el reparto)', () => {
  const partes = repartirDescuento([{ subtotal: 48000 }, { subtotal: 0 }, { subtotal: 42000 }], 9000);
  assert.deepEqual(partes, [4800, 0, 4200]);
});

test('2 COP repartidos entre cuatro líneas nunca se convierten en recargo', () => {
  const lineas = Array.from({ length: 4 }, () => ({ subtotal: 22000 }));
  assert.deepEqual(repartirDescuento(lineas, 2), [1, 1, 0, 0]);
});
