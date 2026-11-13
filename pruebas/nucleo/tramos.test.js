import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITES_DEFECTO, tramoDe, etiquetaTramo, calcularCarrito } from '../../js/nucleo/tramos.js';

const P = {
  F: { sku: 'F', tipo: 'Franela AS Niño', precios: [25000, 24000, 22500, 20000, null], separado: false, oferta: null },
  B: { sku: 'B', tipo: 'Buzo Etanol', precios: [48000, 45000, 42000, 40000, 38000], separado: false, oferta: null },
  Y: { sku: 'Y', tipo: 'Body Serfe', precios: [18000, 17000, 16000, 15000, 14000], separado: true, oferta: null },
  Y2: { sku: 'Y2', tipo: 'Body Serfe', precios: [18000, 17000, 16000, 15000, 14000], separado: true, oferta: null },
};
const opts = { limites: LIMITES_DEFECTO, redondeo: 100 };

test('tramoDe y etiquetas con los tramos del Tarifario', () => {
  assert.deepEqual([1, 5, 6, 11, 12, 23, 24, 48, 49, 200].map(n => tramoDe(n, LIMITES_DEFECTO)), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual([0, 1, 2, 3, 4].map(i => etiquetaTramo(i, LIMITES_DEFECTO)), ['1–5', '6–11', '12–23', '24–48', '49+']);
});

test('el mix suma prendas de distintos productos', () => {
  const r = calcularCarrito([{ sku: 'F', cantidad: 3 }, { sku: 'B', cantidad: 3 }], P, opts);
  assert.equal(r.cantidadMix, 6);
  assert.deepEqual(r.lineas.map(l => l.tramo), [1, 1]);
  assert.equal(r.subtotal, 3 * 24000 + 3 * 45000);
  assert.equal(r.lineas[0].subtotal, 72000);
});

test('«separado» se guarda pero todavía no cambia el tramo: todo cuenta en el mix', () => {
  const s = calcularCarrito([{ sku: 'F', cantidad: 4 }, { sku: 'Y', cantidad: 2 }], P, opts);
  assert.equal(s.cantidadMix, 6);
  assert.deepEqual(s.lineas.map(l => l.tramo), [1, 1]);
});

test('tramo +49 sin precio 5 usa el del tramo 4', () => {
  assert.equal(calcularCarrito([{ sku: 'F', cantidad: 49 }], P, opts).lineas[0].precioUnit, 20000);
});

test('oferta 10% sobre el precio del tramo, redondeada a 100', () => {
  const PO = { ...P, F: { ...P.F, oferta: { pct: 10, activa: true } } };
  const o = calcularCarrito([{ sku: 'F', cantidad: 1 }], PO, opts).lineas[0];
  assert.equal(o.precioUnit, 22500);
  assert.equal(o.oferta, true);
  const inactiva = { ...P, F: { ...P.F, oferta: { pct: 10, activa: false } } };
  assert.equal(calcularCarrito([{ sku: 'F', cantidad: 1 }], inactiva, opts).lineas[0].oferta, false);
});

test('sin aviso cuando faltan más de 3 o no hay siguiente tramo', () => {
  assert.equal(calcularCarrito([{ sku: 'F', cantidad: 2 }], P, opts).aviso, null);
  assert.equal(calcularCarrito([{ sku: 'F', cantidad: 50 }], P, opts).aviso, null);
});

test('cantidades 0, negativas o productos inexistentes se descartan (Review Focus 4)', () => {
  const z = calcularCarrito([{ sku: 'F', cantidad: 0 }, { sku: 'B', cantidad: -2 }, { sku: 'NOEXISTE', cantidad: 1 }, { sku: 'F', cantidad: NaN }], P, opts);
  assert.equal(z.lineas.length, 0);
  assert.equal(z.subtotal, 0);
  assert.equal(z.aviso, null);
});

test('cantidades de texto se convierten; decimales o inválidas se reportan (revisión)', () => {
  const r = calcularCarrito([{ sku: 'F', cantidad: '2' }, { sku: 'B', cantidad: 1.5 }, { sku: 'NOEXISTE', cantidad: 1 }], P, opts);
  assert.deepEqual(r.lineas.map(l => [l.sku, l.cantidad]), [['F', 2]]);
  assert.deepEqual(r.invalidas, [{ sku: 'B', motivo: 'cantidad' }, { sku: 'NOEXISTE', motivo: 'producto' }]);
  const sinPrecio = calcularCarrito([{ sku: 'F', cantidad: 1 }], { F: { ...P.F, precios: [null, null, null, null, null] } }, opts);
  assert.deepEqual(sinPrecio.invalidas, [{ sku: 'F', motivo: 'precio' }]);
});

test('una oferta mayor a 100% no da precios negativos (revisión)', () => {
  const PO = { F: { ...P.F, oferta: { pct: 150, activa: true } } };
  assert.equal(calcularCarrito([{ sku: 'F', cantidad: 1 }], PO, opts).lineas[0].precioUnit, 0);
});

test('precio de tramo vacío o 0 cae al tramo inferior con valor (Review Focus 4)', () => {
  const Q = { F: { ...P.F, precios: [25000, 0, null, null, null] } };
  assert.equal(calcularCarrito([{ sku: 'F', cantidad: 1 }], Q, opts).subtotal, 25000);
  assert.equal(calcularCarrito([{ sku: 'F', cantidad: 7 }], Q, opts).lineas[0].precioUnit, 25000);
  const sinNada = { F: { ...P.F, precios: [null, null, null, null, null] } };
  const r = calcularCarrito([{ sku: 'F', cantidad: 1 }], sinNada, opts);
  assert.equal(r.lineas.length, 0);
  assert.ok(Number.isFinite(r.subtotal));
});
