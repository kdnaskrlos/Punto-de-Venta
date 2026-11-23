// Imprime HUELLA_APP para la publicación, usando exactamente el orden de SHELL.
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '../..');
const worker = readFileSync(path.join(raiz, 'sw.js'), 'utf8');
const shell = worker.match(/const SHELL = \[([\s\S]+?)\];/)[1];
const rutas = [...shell.matchAll(/'([^']+)'/g)].map(m => m[1])
  .filter(ruta => /^(?:index\.html$|(?:js|css)\/)/.test(ruta));
const sha256 = datos => createHash('sha256').update(datos).digest('hex');
const firmas = rutas.map(ruta => {
  const contenido = readFileSync(path.join(raiz, ruta), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  return ruta + '\0' + sha256(contenido) + '\n';
});
console.log(sha256(firmas.join('')));
