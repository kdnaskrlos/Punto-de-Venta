import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoCobro, montoSugerido, vueltoEn, vueltoMixto, elegirMonedaVuelto } from '../../js/nucleo/cobro.js';

const t = { copPorUsd: 3900, bsPorUsd: 1075 };

test('falta lo que no se ha pagado', () => {
  const e = estadoCobro({ total: 116000, pagos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 50000 }], tasas: t, redondeo: 100 });
  assert.equal(e.faltaCop, 66000);
  assert.equal(e.vueltoCop, 0);
  assert.equal(e.cuadra, false);
  assert.equal(e.pagos[0].equivalenteCop, 50000);
});

test('el monto sugerido en Bs cubre lo que falta', () => {
  assert.equal(montoSugerido(66000, 'BS', t), 18192.31);
  assert.equal(montoSugerido(66000, 'USD', t), 16.93);
  assert.equal(montoSugerido(66000, 'COP', t), 66000);
  const e = estadoCobro({ total: 116000, pagos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 50000 }, { forma: 'pago-movil', moneda: 'BS', monto: 18192.31 }], tasas: t, redondeo: 100 });
  assert.equal(e.cuadra, true);
  assert.equal(e.faltaCop, 0);
  assert.equal(e.vueltoCop, 0);
});

test('vuelto en la moneda elegida', () => {
  const e = estadoCobro({ total: 116000, pagos: [{ forma: 'efectivo-usd', moneda: 'USD', monto: 40 }], tasas: t, redondeo: 100 });
  assert.equal(e.vueltoCop, 40000);
  assert.equal(e.cuadra, true);
  assert.equal(vueltoEn(40000, 'BS', t, 100), 11025.64);
  assert.equal(vueltoEn(40049, 'COP', t, 100), 40000);
  assert.equal(vueltoEn(39000, 'USD', t, 100), 10);
});

test('no se puede completar una venta con dinero faltante por el redondeo', () => {
  assert.equal(estadoCobro({ total: 116000, pagos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 115960 }], tasas: t, redondeo: 100 }).cuadra, false);
  assert.equal(estadoCobro({ total: 116000, pagos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 115900 }], tasas: t, redondeo: 100 }).cuadra, false);
});

test('pago en Bs sin tasa no cuenta y no cuadra', () => {
  const e = estadoCobro({ total: 1000, pagos: [{ forma: 'pago-movil', moneda: 'BS', monto: 10 }], tasas: { copPorUsd: 3900, bsPorUsd: null }, redondeo: 100 });
  assert.equal(e.cuadra, false);
  assert.equal(e.pagos[0].equivalenteCop, null);
  assert.equal(e.pagadoCop, 0);
  assert.equal(vueltoEn(1000, 'BS', { copPorUsd: 3900, bsPorUsd: null }, 100), null);
});

test('sin pagos y total 0: cuadra', () => {
  assert.equal(estadoCobro({ total: 0, pagos: [], tasas: t, redondeo: 100 }).cuadra, true);
});

test('v2.06 · vuelto en dólares con su propio redondeo', () => {
  const t = { copPorUsd: 4000, bsPorUsd: 100 };
  assert.equal(vueltoEn(9000, 'USD', t, 100), 2.25);
  assert.equal(vueltoEn(9000, 'USD', t, 100, 1), 2);
  assert.equal(vueltoEn(10800, 'USD', t, 100, 0.5), 2.5);
});

test('bloque 3 · vuelto mixto USD entero y COP redondeado hacia abajo', () => {
  assert.deepEqual(vueltoMixto(38025, t), {
    usd: 9, cop: 2900, remanenteCop: 25, equivalenteCop: 38000,
  });
  assert.deepEqual(vueltoMixto(38025, t, { todoEnPesos: true }), {
    usd: 0, cop: 38000, remanenteCop: 25, equivalenteCop: 38000,
  });
  assert.deepEqual(vueltoMixto(38025, t, { billeteMinimoUsd: 5 }), {
    usd: 5, cop: 18500, remanenteCop: 25, equivalenteCop: 38000,
  });
  assert.equal(vueltoMixto(38025, { copPorUsd: null }), null);
  assert.equal(vueltoMixto(38025, t, { billeteMinimoUsd: 0.01 }), null);
  assert.equal(vueltoMixto(-1, t), null);
});

test('bloque 3 · no redondear centavos de pagos electrónicos', () => {
  const e = estadoCobro({ total: 38025, pagos: [{ forma: 'zelle', moneda: 'USD', monto: 9.75 }], tasas: t });
  assert.equal(e.cuadra, true);
  assert.equal(e.vueltoCop, 0);
  assert.equal(e.pagos[0].equivalenteCop, 38025);
});


const pago = (moneda, efectivo, monto = 1) => ({ forma: { moneda, efectivo }, monto });
const opcionesVuelto = ['MIXTO', 'COP', 'USD'];

test('la selección automática solo prefiere el mixto si se recibió efectivo USD', () => {
  const cop = pago('COP', true), usd = pago('USD', true), electronico = pago('USD', false);
  assert.equal(elegirMonedaVuelto([cop], opcionesVuelto), 'COP');
  assert.equal(elegirMonedaVuelto([usd], opcionesVuelto), 'MIXTO');
  assert.equal(elegirMonedaVuelto([cop, usd], opcionesVuelto), 'MIXTO');
  assert.equal(elegirMonedaVuelto([pago('COP', false), electronico, pago('BS', false)], opcionesVuelto), 'COP');
  assert.equal(elegirMonedaVuelto([cop, pago('USD', true, 0)], opcionesVuelto), 'COP');
});

test('la elección manual se respeta mientras siga disponible aunque cambien los pagos', () => {
  assert.equal(elegirMonedaVuelto([pago('USD', true, 40)], opcionesVuelto, 'COP'), 'COP');
  assert.equal(elegirMonedaVuelto([pago('COP', true, 50000)], opcionesVuelto, 'USD'), 'USD');
  assert.equal(elegirMonedaVuelto([], opcionesVuelto, 'USD'), 'USD');
});

test('si falta el modo preferido, solo se elige una opción calculable', () => {
  const pagos = [pago('USD', true)];
  assert.equal(elegirMonedaVuelto(pagos, ['COP'], 'USD'), 'COP');
  assert.equal(elegirMonedaVuelto(pagos, ['USD']), 'USD');
  assert.equal(elegirMonedaVuelto(pagos, [], 'COP'), null);
});
