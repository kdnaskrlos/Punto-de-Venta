import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoCobro, montoSugerido, vueltoEn } from '../../js/nucleo/cobro.js';

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

test('falta menor que la mitad del redondeo cuenta como pagado', () => {
  assert.equal(estadoCobro({ total: 116000, pagos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 115960 }], tasas: t, redondeo: 100 }).cuadra, true);
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
