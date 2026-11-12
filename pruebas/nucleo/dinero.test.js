import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redondear, fmtCop, fmtDec, fmtMonto, parseMonto } from '../../js/nucleo/dinero.js';

test('fmtCop usa punto de miles y sin decimales', () => {
  assert.equal(fmtCop(116000), '116.000');
  assert.equal(fmtCop(-2500), '-2.500');
  assert.equal(fmtCop(0), '0');
});

test('fmtDec usa coma decimal y 2 decimales', () => {
  assert.equal(fmtDec(18192.307), '18.192,31');
  assert.equal(fmtDec(5), '5,00');
});

test('fmtMonto según la moneda', () => {
  assert.equal(fmtMonto(29.7435, 'USD'), '29,74');
  assert.equal(fmtMonto(116000, 'COP'), '116.000');
  assert.equal(fmtMonto(1075.5, 'BS'), '1.075,50');
});

test('redondear al paso indicado', () => {
  assert.equal(redondear(116049, 100), 116000);
  assert.equal(redondear(116050, 100), 116100);
  assert.equal(redondear(18192.307, 0.01), 18192.31);
  assert.equal(redondear(7.5), 8);
});

test('parseMonto en COP: los puntos son miles (Review Focus 1)', () => {
  assert.equal(parseMonto('10.500', 'COP'), 10500);
  assert.equal(parseMonto('10500', 'COP'), 10500);
  assert.equal(parseMonto('1.250.000', 'COP'), 1250000);
  assert.equal(parseMonto('10.500,00', 'COP'), 10500);
});

test('parseMonto en USD y Bs: decimales con coma o punto (Review Focus 1)', () => {
  assert.equal(parseMonto('10.50', 'USD'), 10.5);
  assert.equal(parseMonto('10,5', 'USD'), 10.5);
  assert.equal(parseMonto('1.234,5', 'BS'), 1234.5);
  assert.equal(parseMonto('1.234', 'BS'), 1234);
  assert.equal(parseMonto('18.192,31', 'BS'), 18192.31);
  assert.equal(parseMonto('40', 'USD'), 40);
});

test('parseMonto rechaza vacío y texto', () => {
  assert.equal(parseMonto('', 'COP'), null);
  assert.equal(parseMonto('abc', 'USD'), null);
  assert.equal(parseMonto(null, 'USD'), null);
});
