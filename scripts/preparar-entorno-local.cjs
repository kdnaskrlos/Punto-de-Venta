#!/usr/bin/env node
/**
 * Crea una copia local del POS que SOLO se conecta a Firebase Emulator Suite.
 * NO modifica archivos fuente ni la rama publicada de GitHub Pages.
 * Ejecutar: node scripts/preparar-entorno-local.cjs ../Punto-de-Venta-LAB
 */
const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } = require('node:fs');
const { dirname, isAbsolute, resolve, relative, sep, join } = require('node:path');

const raiz = resolve(__dirname, '..');
const destino = resolve(process.argv[2] || '../Punto-de-Venta-LAB');
const dentro = relative(raiz, destino);
if (destino === raiz || (!dentro.startsWith('..' + sep) && dentro !== '..' && !isAbsolute(dentro))) {
  throw new Error('El destino debe estar FUERA del repositorio. Ejemplo: ../Punto-de-Venta-LAB');
}
if (existsSync(destino)) throw new Error('El destino ya existe. Elige una carpeta NUEVA para evitar borrar datos.');
mkdirSync(destino, { recursive: true });

try {
  // Copiar únicamente archivos versionados. Nunca copiar claves privadas, .git ni dependencias.
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: raiz }).toString().split('\0').filter(Boolean);
  for (const archivo of tracked) {
    const origen = resolve(raiz, archivo), salida = resolve(destino, archivo);
    if (!salida.startsWith(destino + sep)) throw new Error('Ruta fuera del destino: ' + archivo);
    mkdirSync(dirname(salida), { recursive: true });
    copyFileSync(origen, salida);
  }

  const firebaseRuta = join(destino, 'js/datos/firebase.js');
  let codigo = readFileSync(firebaseRuta, 'utf8');
  const authImport = "getAuth, onAuthStateChanged";
  const storeImport = "initializeFirestore, persistentLocalCache";
  if (!codigo.includes(authImport) || !codigo.includes(storeImport)) {
    throw new Error('SDK Firebase cambió: revisar adaptador antes de preparar el LAB.');
  }
  codigo = codigo.replace(authImport, 'getAuth, connectAuthEmulator, onAuthStateChanged');
  codigo = codigo.replace(storeImport, 'initializeFirestore, connectFirestoreEmulator, persistentLocalCache');

  const firma = "  const app = initializeApp(config);\n  const auth = getAuth(app);\n  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });";
  if (!codigo.includes(firma)) throw new Error('Inicialización Firebase cambió: NO se permite conexión sin aislamiento.');
  const aislado = [
    "  // LAB: la copia NO puede ejecutarse fuera del equipo local ni contra otro proyecto.",
    "  if (!['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('LAB solo en localhost');",
    "  if (config.projectId !== 'demo-pos-local') throw new Error('Proyecto Firebase distinto del emulador');",
    "  const app = initializeApp(config);",
    "  const auth = getAuth(app);",
    "  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });",
    "  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });",
    "  connectFirestoreEmulator(db, '127.0.0.1', 8080);",
  ].join('\n');
  codigo = codigo.replace(firma, aislado);
  writeFileSync(firebaseRuta, codigo);

  // Esta configuración FICTICIA nunca se copia al proyecto publicado.
  writeFileSync(join(destino, 'config.js'), [
    '// LAB LOCAL: configuración ficticia. Solo Auth y Firestore emulados.',
    'export const firebaseConfig = {',
    "  apiKey: 'fake-demo-pos-local',",
    "  authDomain: 'demo-pos-local.firebaseapp.com',",
    "  projectId: 'demo-pos-local',",
    "  appId: '1:000000000000:web:demo-pos-local',",
    '};',
    '',
  ].join('\n'));

  // Evita un SW en el LAB: sin mezclas de cachés al probar código iterativamente.
  const htmlRuta = join(destino, 'index.html');
  const html = readFileSync(htmlRuta, 'utf8');
  const scriptSW = '<script type="module" src="js/arranque-pwa.js"></script>';
  if (!html.includes(scriptSW)) throw new Error('index.html no contiene el arranque PWA esperado.');
  writeFileSync(htmlRuta, html.replace(scriptSW, '<!-- LAB: service worker desactivado -->'));

  const emulatorConfig = {
    emulators: {
      auth: { host: '127.0.0.1', port: 9099 },
      firestore: { host: '127.0.0.1', port: 8080 },
      ui: { enabled: true, host: '127.0.0.1', port: 4000 },
    },
    firestore: { rules: 'firestore.rules' },
  };
  writeFileSync(join(destino, 'firebase.json'), JSON.stringify(emulatorConfig, null, 2) + '\n');

  const instruccion = [
    'PUNTO DE VENTA — LAB LOCAL (DATOS FICTICIOS)',
    '',
    'Requisitos: Node.js, Python 3, Java y acceso a Internet para el SDK de Firebase.',
    '',
    'TERMINAL 1 (dentro de esta carpeta):',
    '  npx --yes firebase-tools@15.0.0 emulators:start --project demo-pos-local --only auth,firestore',
    '',
    'TERMINAL 2 (dentro de esta carpeta):',
    '  python3 -m http.server 8000 --bind 127.0.0.1',
    '',
    'Navegador: http://127.0.0.1:8000/',
    'Consola de emuladores: http://127.0.0.1:4000/',
    '',
    'Crea el primer administrador y realiza pruebas únicamente en esta dirección local.',
    'Al cerrar los emuladores sin exportar, sus datos desaparecen.',
    'NO uses ?demo si deseas probar las reglas de Firebase: ?demo usa almacenamiento local.',
    'No expongas los puertos 8000, 8080 ni 9099 a Internet.',
    '',
  ].join('\n');
  writeFileSync(join(destino, 'LEEME-LAB.txt'), instruccion);
  console.log(instruccion);
  console.log('Entorno aislado preparado:', destino);
} catch (error) {
  // Esta carpeta la acaba de crear el script; se limpia ante un error parcial.
  rmSync(destino, { recursive: true, force: true });
  throw error;
}
