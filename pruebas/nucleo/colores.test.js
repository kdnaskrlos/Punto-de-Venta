import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorPrenda } from '../../js/nucleo/colores.js';

test('color de la prenda por su nombre, con o sin tildes y compuestos', () => {
  assert.equal(colorPrenda('Blanco'), '#ffffff');
  assert.equal(colorPrenda('azul marino'), '#1e3a8a');
  assert.equal(colorPrenda('Franela Azul Marino'), '#1e3a8a');
  assert.equal(colorPrenda('Marrón'), '#7c4a2d');
  assert.equal(colorPrenda('Tornasol'), null);
  assert.equal(colorPrenda(''), null);
});
