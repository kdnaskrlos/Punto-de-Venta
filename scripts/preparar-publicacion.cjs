// Construye un árbol estático para el mismo origen/alcance de la instalación.
// No escribe en el repositorio ni despliega. Requiere un directorio nuevo.
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const ANTERIOR = '1423e187fba3cfe0bda293baaaa26c3350ef7cf2';
const PUENTE_HISTORICO = '57799ec9e3758883afb41b282e59e61d6e7d7936';
const ESTABLES = [
  'js/datos/firebase.js', 'js/datos/memoria.js', 'js/datos/pendientes.js',
  'js/nucleo/ejemplos.js', 'js/vistas/mas.js', 'js/vistas/vender.js', 'js/vistas/venta-en-curso.js',
];
const versionado = ruta => /^(?:index\.html$|config\.js$|(?:js|css)\/)/.test(ruta);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function leerShell(worker) {
  const shell = worker.match(/const SHELL = \[([\s\S]+?)\];/)[1];
  return [...shell.matchAll(/'([^']+)'/g)].map(m => m[1]);
}

function huella(rutas, leer) {
  return sha256(rutas.map(ruta => ruta + '\0' + sha256(leer(ruta)) + '\n').join(''));
}

function preparar(destino, { fuente = RAIZ, conservar } = {}) {
  const worker = readFileSync(path.join(fuente, 'sw.js'), 'utf8');
  const rutas = leerShell(worker);
  const leer = ruta => readFileSync(path.join(fuente, ruta));
  const version = leer('js/version.js').toString().match(/export const APP_VERSION = '(v[\d.]+)'/)[1];
  // Incluye el worker para distinguir publicaciones que solo cambian su política de caché.
  const id = version + '-' + sha256(worker + '\0' + huella(rutas, leer)).slice(0, 16);
  const prefijo = 'versiones/' + id + '/';
  const publico = leer('index.html').toString().replace(/(href|src)="((?:js|css)\/[^"]+)"/g,
    (_, attr, ruta) => attr + '="' + prefijo + ruta + '"');
  const publicacion = {
    prefijo, cache: 'pos-' + id,
    huella: huella(rutas, ruta => ruta === 'index.html' ? publico : leer(ruta)),
  };

  mkdirSync(destino);
  if (conservar) {
    // Las URL históricas también forman un conjunto estable entre publicaciones.
    for (const dir of ['versiones', 'js', 'css']) {
      cpSync(path.join(conservar, dir), path.join(destino, dir), { recursive: true });
    }
  } else {
    // Las rutas sin versión pertenecen al puente que ya consumen instalaciones antiguas.
    for (const [ref, rutas] of [[ANTERIOR, ['js', 'css']], [PUENTE_HISTORICO, ESTABLES]]) {
      const archivos = execFileSync('git', ['archive', ref, ...rutas], {
        cwd: RAIZ, maxBuffer: 16 * 1024 * 1024,
      });
      execFileSync('tar', ['-x', '-C', destino], { input: archivos });
    }
  }

  for (const ruta of rutas) {
    const archivo = path.join(destino, versionado(ruta) ? prefijo + ruta : ruta);
    mkdirSync(path.dirname(archivo), { recursive: true });
    writeFileSync(archivo, ruta === 'index.html' ? publico : leer(ruta));
  }
  copyFileSync(path.join(fuente, 'config.js'), path.join(destino, 'config.js'));
  cpSync(path.join(fuente, 'fotos'), path.join(destino, 'fotos'), { recursive: true });
  writeFileSync(path.join(destino, '.nojekyll'), '');
  writeFileSync(path.join(destino, 'index.html'), publico);
  writeFileSync(path.join(destino, 'sw.js'), worker.replace('const PUBLICACION = null;',
    'const PUBLICACION = ' + JSON.stringify(publicacion) + ';'));
  return { ...publicacion, version };
}

if (require.main === module) {
  const destino = process.argv[2];
  if (!destino) throw new Error('Indica un directorio nuevo para la publicación local');
  console.log(JSON.stringify(preparar(path.resolve(destino), { conservar: process.argv[3] }), null, 2));
}

module.exports = { huella, leerShell, preparar };
