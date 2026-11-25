// Genera dos sitios estáticos de demostración para ensayar la transición en el mismo origen.
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { preparar } = require('./preparar-publicacion.cjs');

const [, , directorio, opcion, archivo] = process.argv;
if (!directorio || (opcion && (opcion !== '--firebase-qa' || !archivo || process.argv.length !== 5))) {
  throw new Error('Uso: node scripts/preparar-piloto.cjs DIRECTORIO_NUEVO [--firebase-qa CONFIG_PUBLICA.json]');
}
const salida = path.resolve(directorio);
let configQA = null;
if (archivo) {
  const campos = ['projectId', 'authDomain', 'apiKey', 'appId'];
  const config = JSON.parse(readFileSync(archivo, 'utf8'));
  if (!campos.every(k => typeof config?.[k] === 'string' && config[k].trim())
    || !(/^pos-qa-[a-z0-9-]{4,}$/.test(config.projectId)
      || (config.projectId === 'punto-de-venta-comic-shop'
        && process.env.POS_QA_ALLOW_EXISTING_PROJECT === config.projectId
        && process.env.POS_QA_CONFIRM_NONOPERATIVE === 'SI_POS_NO_OPERATIVO'))
    || config.authDomain !== config.projectId + '.firebaseapp.com') {
    throw new Error('BLOQUEADO: configuración pública inválida o proyecto Firebase existente sin autorización explícita');
  }
  configQA = Object.fromEntries(campos.map(k => [k, config[k]]));
}
const raiz = path.resolve(__dirname, '..');
const temporal = mkdtempSync(path.join(tmpdir(), 'pos-piloto-'));
const BASE_V242 = 'aa7633976a409f6c9613101898a7d0739cf1df61';

function fuente(revision, nombre) {
  const dir = path.join(temporal, nombre);
  mkdirSync(dir);
  execFileSync('tar', ['-x', '-C', dir], {
    input: execFileSync('git', ['archive', revision], { cwd: raiz, maxBuffer: 16 * 1024 * 1024 }),
  });
  const config = configQA && { ...configQA, ...(nombre === 'candidata' ? { ventasAtomicas: true } : {}) };
  writeFileSync(path.join(dir, 'config.js'), 'export const firebaseConfig = ' + JSON.stringify(config) + ';\n');
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
  writeFileSync(path.join(salida, 'versiones.json'), JSON.stringify({ commit, ...(configQA ? { proyectoQA: configQA.projectId } : {}), anterior, actual }, null, 2) + '\n');
  const instruccionesQA = 'Configuración Firebase QA. Sigue docs/VALIDACION-FINAL-V243.md del repositorio para servir ambos árboles en un único origen HTTPS aislado.\n';
  writeFileSync(path.join(salida, 'LEEME.txt'), configQA ? instruccionesQA : `POS · piloto de demostración para PC y Android

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
