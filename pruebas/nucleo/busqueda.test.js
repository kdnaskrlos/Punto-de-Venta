import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coincide } from '../../js/nucleo/busqueda.js';

const prenda = 'Jogger Texcol Caballero J-M 7700000012 Jogger Negro M Caballero Texcol';
test('palabras en cualquier orden, sin tildes ni mayúsculas', () => {
  assert.equal(coincide(prenda, 'negro jogger'), true);
  assert.equal(coincide('Franela AS Niño Blanco', 'nino franela'), true);
  assert.equal(coincide(prenda, 'jogger rojo'), false);
  assert.equal(coincide(prenda, ''), true);
});
test('talla de 1 o 2 letras: comienzo de palabra', () => {
  assert.equal(coincide(prenda, 'jogger m'), true);
  assert.equal(coincide('Buzo Etanol Caballero Gris S', 'xl'), false);
  assert.equal(coincide('Body Serfe Unisex Rosa 3m', 'ro'), true);
});
test('plurales y códigos sin guiones', () => {
  assert.equal(coincide('Franela AS Niño', 'franelas'), true);
  assert.equal(coincide(prenda, 'joggers'), true);
  assert.equal(coincide('F-B-4 Franela', 'fb4'), true);
  assert.equal(coincide(prenda, 'j-m'), true);
});
test('teléfonos con espacios, guiones o +58', () => {
  const ap = 'Ana Pérez 584121234567';
  assert.equal(coincide(ap, '0412 123'), true);
  assert.equal(coincide(ap, '0414'), false);
  assert.equal(coincide(ap, '412 1234'), true);
  assert.equal(coincide(ap, '+58412'), true);
  assert.equal(coincide(ap, 'perez'), true);
});
