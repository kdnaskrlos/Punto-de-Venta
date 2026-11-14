import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claveFoto, emparejarFotos } from '../../js/nucleo/fotos.js';

test('la clave ignora mayúsculas, acentos, espacios, guiones y extensión', () => {
  assert.equal(claveFoto('Fran-AS-Niño Blanco.JPG'), 'franasninoblanco');
  assert.equal(claveFoto('Franela AS Niño Blanco'), 'franelaasninoblanco');
  assert.equal(claveFoto('buzo_etanol  gris.webp'), 'buzoetanolgris');
});

test('empareja la foto con la variante por su sku (sin importar mayúsculas, acentos ni extensión)', () => {
  const r = emparejarFotos(['fran-as-nino-4-bla-alg.JPG', 'otra.png', 'B-M.webp'], ['Fran-AS-Niño-4-Bla-Alg', 'B-M', 'B-L']);
  assert.deepEqual(r.asignadas, [{ archivo: 'fran-as-nino-4-bla-alg.JPG', sku: 'Fran-AS-Niño-4-Bla-Alg' }, { archivo: 'B-M.webp', sku: 'B-M' }]);
  assert.deepEqual(r.sinAsignar, ['otra.png']);
});

test('empareja primero por código de imagen (img-0001.jpg) y si no, por sku', () => {
  const r = emparejarFotos(['IMG-0001.jpg', 'img-0002.PNG', 'B-M.webp', 'nada.png'], ['B-M', 'B-L'], ['img-0001', 'img-0002']);
  assert.deepEqual(r.asignadas, [{ archivo: 'IMG-0001.jpg', codigo: 'img-0001' }, { archivo: 'img-0002.PNG', codigo: 'img-0002' }, { archivo: 'B-M.webp', sku: 'B-M' }]);
  assert.deepEqual(r.sinAsignar, ['nada.png']);
});
