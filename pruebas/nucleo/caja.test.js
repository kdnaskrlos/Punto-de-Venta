import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esperadoCaja, diferenciasCierre } from '../../js/nucleo/caja.js';
import { FORMAS_PAGO_DEFECTO as FORMAS } from '../../js/nucleo/formas.js';

const t = { copPorUsd: 3900, bsPorUsd: 1075 };
const caja = { fondo: { COP: 50000, USD: 20, BS: 500 }, movimientos: [{ tipo: 'salida', forma: 'efectivo-cop', monto: 10000, motivo: 'gasto' }] };

test('formas de pago por defecto (§9.1)', () => {
  assert.deepEqual(FORMAS.map(f => f.id), ['efectivo-cop', 'transferencia-cop', 'efectivo-usd', 'zelle', 'usdt', 'efectivo-bs', 'pago-movil', 'punto']);
  assert.deepEqual(FORMAS.filter(f => f.efectivo).map(f => f.id), ['efectivo-cop', 'efectivo-usd', 'efectivo-bs']);
});

test('esperado = fondo + cobros − vuelto − salidas + entradas + abonos', () => {
  const ventas = [{ estado: 'ok', pagos: [{ forma: 'efectivo-cop', monto: 120000 }, { forma: 'pago-movil', monto: 5000 }], vuelto: { moneda: 'COP', monto: 4000 } }];
  const esp = esperadoCaja({ ...caja, movimientos: [...caja.movimientos, { tipo: 'entrada', forma: 'efectivo-usd', monto: 5 }] }, ventas, [{ forma: 'zelle', monto: 10 }], FORMAS);
  assert.equal(esp['efectivo-cop'], 50000 + 120000 - 4000 - 10000);
  assert.equal(esp['pago-movil'], 5000);
  assert.equal(esp['efectivo-usd'], 25);
  assert.equal(esp['efectivo-bs'], 500);
  assert.equal(esp['zelle'], 10);
  assert.equal(esp['punto'], 0);
});

test('las ventas anuladas no cuentan', () => {
  const esp = esperadoCaja({ fondo: { COP: 0, USD: 0, BS: 0 }, movimientos: [] }, [{ estado: 'anulada', pagos: [{ forma: 'efectivo-cop', monto: 30000 }], vuelto: null }], [], FORMAS);
  assert.equal(esp['efectivo-cop'], 0);
});

test('vuelto en Bs sale del efectivo en Bs', () => {
  const esp = esperadoCaja({ fondo: { COP: 0, USD: 0, BS: 1000 }, movimientos: [] }, [{ estado: 'ok', pagos: [{ forma: 'efectivo-usd', monto: 40 }], vuelto: { moneda: 'BS', monto: 200.5 } }], [], FORMAS);
  assert.equal(esp['efectivo-bs'], 799.5);
  assert.equal(esp['efectivo-usd'], 40);
});

test('diferencias: ok, leve (≤ 1% o 2.000) y grave', () => {
  const d = diferenciasCierre({ 'efectivo-cop': 156000 }, { 'efectivo-cop': 154500 }, FORMAS, t);
  assert.equal(d.filas.length, 1);
  assert.deepEqual(d.filas[0], { forma: 'efectivo-cop', moneda: 'COP', esperado: 156000, contado: 154500, diferencia: -1500, nivel: 'leve' });
  assert.equal(diferenciasCierre({ 'efectivo-cop': 156000 }, { 'efectivo-cop': 150000 }, FORMAS, t).filas[0].nivel, 'grave');
  assert.equal(diferenciasCierre({ 'efectivo-cop': 156000 }, { 'efectivo-cop': 156000 }, FORMAS, t).filas[0].nivel, 'ok');
  assert.equal(diferenciasCierre({ 'efectivo-cop': 1000000 }, { 'efectivo-cop': 990000 }, FORMAS, t).filas[0].nivel, 'leve');
});

test('diferencias en otra moneda se juzgan en pesos y se totalizan', () => {
  const d = diferenciasCierre({ 'efectivo-usd': 20, 'pago-movil': 5000 }, { 'efectivo-usd': 19, 'pago-movil': 5000 }, FORMAS, t);
  assert.equal(d.filas.find(f => f.forma === 'efectivo-usd').nivel, 'grave'); // 1 USD = 3.900 COP
  assert.equal(d.totalCop, -3900);
  assert.equal(d.totalEsperadoCop, 20 * 3900 + Math.round(5000 * 3900 / 1075));
});
