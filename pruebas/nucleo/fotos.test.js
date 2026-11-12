import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claveFoto, emparejarFotos } from '../../js/nucleo/fotos.js';

test('la clave ignora mayúsculas, acentos, espacios, guiones y extensión', () => {
  assert.equal(claveFoto('Fran-AS-Niño Blanco.JPG'), 'franasninoblanco');
  assert.equal(claveFoto('Franela AS Niño Blanco'), 'franelaasninoblanco');
  assert.equal(claveFoto('buzo_etanol  gris.webp'), 'buzoetanolgris');
});

test('empareja por nombre de archivo con el grupo', () => {
  const r = emparejarFotos(['Franela AS Niño-Blanco.jpg', 'otra.png', 'BUZO ETANOL GRIS.jpeg'], ['Franela AS Niño Blanco', 'Buzo Etanol Gris']);
  assert.deepEqual(r.asignadas, [{ archivo: 'Franela AS Niño-Blanco.jpg', grupo: 'Franela AS Niño Blanco' }, { archivo: 'BUZO ETANOL GRIS.jpeg', grupo: 'Buzo Etanol Gris' }]);
  assert.deepEqual(r.sinAsignar, ['otra.png']);
});
