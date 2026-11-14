import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fotoDe } from '../../js/nucleo/producto.js';

test('la foto sale del código de imagen; si no hay, la del sku; si no, ninguna', () => {
  const imagenes = { 'img-0001': 'fotos/img-0001.webp' };
  assert.equal(fotoDe({ id_imagen: 'img-0001', foto: 'fotos/sku.webp' }, imagenes), 'fotos/img-0001.webp');
  assert.equal(fotoDe({ id_imagen: 'img-0002', foto: 'fotos/sku.webp' }, imagenes), 'fotos/sku.webp');
  assert.equal(fotoDe({ id_imagen: 'img-0002' }, imagenes), null);
  assert.equal(fotoDe({}, undefined), null);
});
