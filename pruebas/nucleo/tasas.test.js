import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tasasVigentes, aCop, desdeCop, copPorBs } from '../../js/nucleo/tasas.js';

const aj = { copPorUsd: 3900, copActualizada: '2026-11-12T12:00:00Z', bsModo: 'binance', bsRecargo: 15, bsManual: null };
const tj = { rate: 1060, updated_at: '2026-11-12T14:10:27Z', bcv: { rate: 236.5, updated_at: '2026-11-12T04:00:00Z' } };

test('Binance con recargo', () => {
  const t = tasasVigentes(aj, tj, null);
  assert.equal(t.bsPorUsd, 1075);
  assert.equal(t.fuenteBs, 'binance');
  assert.equal(t.ultimaConocida, false);
  assert.equal(t.copPorUsd, 3900);
  assert.equal(t.bsActualizada, '2026-11-12T14:10:27Z');
});

test('BCV y manual', () => {
  assert.equal(tasasVigentes({ ...aj, bsModo: 'bcv' }, tj, null).bsPorUsd, 236.5);
  const m = tasasVigentes({ ...aj, bsModo: 'manual', bsManual: 1100 }, null, null);
  assert.equal(m.bsPorUsd, 1100);
  assert.equal(m.fuenteBs, 'manual');
});

test('sin tasa.json usa la última conocida', () => {
  const c = tasasVigentes(aj, null, { bsPorUsd: 1070, fuenteBs: 'binance', bsActualizada: '2026-11-11T10:00:00Z' });
  assert.equal(c.bsPorUsd, 1070);
  assert.equal(c.ultimaConocida, true);
});

test('conversiones con los números del boceto', () => {
  const t = tasasVigentes(aj, tj, null);
  assert.equal(aCop(50, 'USD', t), 195000);
  assert.equal(aCop(18192.31, 'BS', t), 66000);
  assert.equal(aCop(50000, 'COP', t), 50000);
  assert.equal(desdeCop(66000, 'BS', t, { haciaArriba: true }), 18192.31);
  assert.equal(desdeCop(116000, 'USD', t), 29.74);
  assert.equal(desdeCop(116000, 'COP', t), 116000);
  assert.equal(copPorBs(t), 3900 / 1075);
});

test('tasa de Bs ausente, 0 o texto: null, nunca NaN (Review Focus 2)', () => {
  const sin = tasasVigentes(aj, null, null);
  assert.equal(sin.bsPorUsd, null);
  assert.equal(aCop(100, 'BS', sin), null);
  assert.equal(desdeCop(1000, 'BS', sin), null);
  assert.equal(copPorBs(sin), null);
  assert.equal(tasasVigentes(aj, { rate: 0 }, null).bsPorUsd, null);
  assert.equal(tasasVigentes(aj, { rate: 'x' }, null).bsPorUsd, null);
  assert.equal(tasasVigentes({ ...aj, bsModo: 'bcv' }, { rate: 1060 }, null).bsPorUsd, null);
});

test('tasa COP ausente: conversiones a USD también null', () => {
  const t = tasasVigentes({ ...aj, copPorUsd: 0 }, tj, null);
  assert.equal(t.copPorUsd, null);
  assert.equal(aCop(10, 'USD', t), null);
  assert.equal(aCop(10, 'BS', t), null);
});
