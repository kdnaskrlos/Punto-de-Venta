import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claveFoto, emparejarFotos } from '../../js/nucleo/fotos.js';

test('la clave ignora mayúsculas, acentos, espacios, guiones y extensión', () => {
  assert.equal(claveFoto('Fran-AS-Niño Blanco.JPG'), 'franasninoblanco');
  assert.equal(claveFoto('Franela AS Niño Blanco'), 'franelaasninoblanco');
  assert.equal(claveFoto('buzo_etanol  gris.webp'), 'buzoetanolgris');
});

test('empareja solo por código de imagen (img-0001.jpg); un sku no se reconoce', () => {
  const r = emparejarFotos(['IMG-0001.jpg', 'img-0002.PNG', 'B-M.webp', 'nada.png'], ['img-0001', 'img-0002']);
  assert.deepEqual(r.asignadas, [{ archivo: 'IMG-0001.jpg', codigo: 'img-0001' }, { archivo: 'img-0002.PNG', codigo: 'img-0002' }]);
  assert.deepEqual(r.sinAsignar, ['B-M.webp', 'nada.png']);
});
