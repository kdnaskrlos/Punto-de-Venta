import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaLocal } from '../../js/nucleo/fechas.js';

test('una venta de las 10 pm en Caracas cuenta en su día, no en el siguiente (UTC)', () => {
  assert.equal(diaLocal('2026-11-13T02:00:00Z'), '2026-11-12');
  assert.equal(diaLocal('2026-11-12T15:00:00Z'), '2026-11-12');
});

test('inicio del día de la tienda en UTC (Caracas = UTC−4)', async () => {
  const { inicioDia } = await import('../../js/nucleo/fechas.js');
  assert.equal(inicioDia('2026-11-12'), '2026-11-12T04:00:00.000Z');
});
