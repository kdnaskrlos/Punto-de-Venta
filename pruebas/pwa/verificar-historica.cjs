// Ejecuta la suite histórica completa y diferencia dos fallos ya documentados.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const caso = path.join(__dirname, 'regresion-actualizacion.cjs');
const resultado = spawnSync(process.execPath, ['--test', '--test-reporter=spec', caso], { encoding: 'utf8' });
const salida = resultado.stdout || '';
process.stdout.write(salida);
process.stderr.write(resultado.stderr || '');
if (resultado.status === 0) process.exit(0);

const pruebas = salida.match(/^ℹ tests (\d+)$/m);
const fallos = salida.match(/^ℹ fail (\d+)$/m);
const esperados = new Set(['04', '05']);
const observados = new Set();
for (const linea of salida.split('\n')) {
  if (!linea.startsWith('✖ ') || linea === '✖ failing tests:') continue;
  const id = linea.match(/^✖ (\d{2}) · /)?.[1];
  if (!esperados.has(id)) process.exit(1);
  observados.add(id);
}
if (pruebas?.[1] !== '8' || !observados.size || Number(fallos?.[1]) !== observados.size) process.exit(1);
console.warn('Limitaciones verificadas de v2.35: ' + [...observados].join(', ') + '. Aplicar la migración supervisada.');
