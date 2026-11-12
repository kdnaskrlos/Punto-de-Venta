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

import { diasCalendario, mesCorto, rangoCorto } from '../../js/nucleo/fechas.js';

test('calendario: 6 semanas fijas (42 días) empezando en domingo', () => {
  const nov = diasCalendario(2026, 11);
  assert.equal(nov.length, 42);
  assert.deepEqual(nov[0], { fecha: '2026-11-01', dia: 1, delMes: true });
  assert.deepEqual(nov[29], { fecha: '2026-11-30', dia: 30, delMes: true });
  assert.deepEqual(nov[30], { fecha: '2026-12-01', dia: 1, delMes: false });
  const dic = diasCalendario(2026, 12);
  assert.deepEqual(dic[0], { fecha: '2026-11-29', dia: 29, delMes: false });
  assert.equal(dic[2].fecha, '2026-12-01');
  const ene = diasCalendario(2027, 1);
  assert.equal(ene[0].fecha, '2026-12-27');
});

test('textos cortos de mes y rango', () => {
  assert.equal(mesCorto(2026, 11), 'Noviembre 2026');
  assert.equal(rangoCorto('2026-11-12', '2026-11-12'), '12 nov');
  assert.equal(rangoCorto('2026-11-09', '2026-11-15'), '9 – 15 nov');
  assert.equal(rangoCorto('2026-10-28', '2026-11-03'), '28 oct – 3 nov');
  assert.equal(rangoCorto('2025-12-28', '2026-01-03'), '28 dic 2025 – 3 ene');
});
