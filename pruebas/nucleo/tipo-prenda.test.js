import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compararTallas, tipoPrenda } from '../../js/nucleo/tipo-prenda.js';

test('compararTallas: letras, números y meses en su orden natural', () => {
  assert.deepEqual(['L', 'S', 'XL', 'M', 'XXL'].sort(compararTallas), ['S', 'M', 'L', 'XL', 'XXL']);
  assert.deepEqual(['10', '4', '8', '6'].sort(compararTallas), ['4', '6', '8', '10']);
  assert.deepEqual(['9m', '3m', '6m'].sort(compararTallas), ['3m', '6m', '9m']);
});

test('tipoPrenda: reconoce el tipo por el nombre', () => {
  assert.equal(tipoPrenda('Buzo Etanol'), 'buzo');
  assert.equal(tipoPrenda('Jogger Texcol'), 'pantalon');
  assert.equal(tipoPrenda('Body Bebé Serfe'), 'body');
  assert.equal(tipoPrenda('Franela AS Niño'), 'franela');
});
