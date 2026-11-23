// Imprime HUELLA_APP para el árbol de desarrollo con el orden exacto de SHELL.
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { huella, leerShell } = require('../../scripts/preparar-publicacion.cjs');

const raiz = path.resolve(__dirname, '../..');
const leer = ruta => readFileSync(path.join(raiz, ruta));
console.log(huella(leerShell(leer('sw.js').toString()), leer));
