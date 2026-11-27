const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const origen = join(__dirname, '../js/nucleo');
const destino = join(__dirname, '../funciones/nucleo');
const modulos = ['cobro', 'comisiones', 'descuento', 'dinero', 'fechas', 'formas', 'tasas', 'tramos'];
const comprobar = process.argv.includes('--comprobar');
if (!comprobar) mkdirSync(destino, { recursive: true });
for (const modulo of modulos) {
  const contenido = readFileSync(join(origen, modulo + '.js'), 'utf8')
    .replace(/(from '\.\/[^']+)\.js'/g, "$1.mjs'");
  const archivo = join(destino, modulo + '.mjs');
  if (comprobar) {
    if (readFileSync(archivo, 'utf8') !== contenido) throw new Error('Núcleo de ventas desactualizado: ' + modulo);
  } else writeFileSync(archivo, contenido);
}
