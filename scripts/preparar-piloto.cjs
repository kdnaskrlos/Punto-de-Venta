// Genera dos sitios estáticos de demostración para ensayar la transición en el mismo origen.
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { preparar } = require('./preparar-publicacion.cjs');

if (!process.argv[2]) throw new Error('Indica un directorio nuevo para el piloto');
const salida = path.resolve(process.argv[2]);
const raiz = path.resolve(__dirname, '..');
const temporal = mkdtempSync(path.join(tmpdir(), 'pos-piloto-'));
const BASE_V242 = 'aa7633976a409f6c9613101898a7d0739cf1df61';

function fuente(revision, nombre) {
  const dir = path.join(temporal, nombre);
  mkdirSync(dir);
  execFileSync('tar', ['-x', '-C', dir], {
    input: execFileSync('git', ['archive', revision], { cwd: raiz, maxBuffer: 16 * 1024 * 1024 }),
  });
  writeFileSync(path.join(dir, 'config.js'), 'export const firebaseConfig = null;\n');
  return dir;
}

try {
  mkdirSync(salida);
  const base = path.join(salida, 'base', 'Punto-de-Venta');
  const candidata = path.join(salida, 'candidata', 'Punto-de-Venta');
  for (const dir of [base, candidata]) mkdirSync(path.dirname(dir));
  const anterior = preparar(base, { fuente: fuente(BASE_V242, 'base') });
  const actual = preparar(candidata, { fuente: fuente('HEAD', 'candidata'), conservar: base });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: raiz, encoding: 'utf8' }).trim();
  writeFileSync(path.join(salida, 'versiones.json'), JSON.stringify({ commit, anterior, actual }, null, 2) + '\n');
  writeFileSync(path.join(salida, 'LEEME.txt'), `POS · piloto de demostración para PC y Android

1. Sirve el contenido de base/ con HTTPS en un origen de pruebas accesible por el dispositivo.
2. Abre /Punto-de-Venta/ en Chrome e instala la app si el navegador lo ofrece.
3. Crea un borrador en demostración. Cambia el sitio servido por candidata/ conservando el mismo HTTPS y ruta.
4. Deja que se instale la actualización, cierra las ventanas del POS y reabre. Comprueba que se ofrece retomar el mismo carrito.
5. Repite con y sin red después de activar la candidata. Para revertir, repón index.html y sw.js de base/Punto-de-Venta/ juntos y conserva los dos grafos.

Ambos sitios usan datos sintéticos. Su configuración de Firebase es nula. Este archivo es para un origen QA separado.
`);
} finally {
  rmSync(temporal, { recursive: true, force: true });
}
