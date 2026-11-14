import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fotoDe } from '../../js/nucleo/producto.js';

test('la foto sale solo del código de imagen; sin código o sin foto subida, ninguna (no hay respaldo por sku)', () => {
  const imagenes = { 'img-0001': 'fotos/img-0001.webp' };
  assert.equal(fotoDe({ id_imagen: 'img-0001', foto: 'fotos/sku.webp' }, imagenes), 'fotos/img-0001.webp');
  assert.equal(fotoDe({ id_imagen: 'img-0002', foto: 'fotos/sku.webp' }, imagenes), null);
  assert.equal(fotoDe({ foto: 'fotos/sku.webp' }, imagenes), null);
  assert.equal(fotoDe({}, undefined), null);
});
