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
const esperados = new Map([
  ['04', 'El cierre de v2.35 no debe eliminar el borrador compartido'],
  ['05', 'La pestaña vacía de v2.35 borró el carrito de la misma cuenta'],
]);
const encabezados = salida.split('✖ failing tests:\n');
const observados = new Set();
for (const detalle of encabezados[1]?.split(/^✖ /m).slice(1) || []) {
  const id = detalle.match(/^(\d{2}) · /)?.[1];
  const causa = esperados.get(id);
  if (!causa || !detalle.includes('AssertionError [ERR_ASSERTION]: ' + causa)) process.exit(1);
  observados.add(id);
}
if (encabezados.length !== 2 || pruebas?.[1] !== '8' || !observados.size
  || Number(fallos?.[1]) !== observados.size) process.exit(1);
console.warn('Limitaciones verificadas de v2.35: ' + [...observados].join(', ') + '. Aplicar la migración supervisada.');
