const { createRequire } = require('node:module');
const path = require('node:path');

if (!/^127\.0\.0\.1:[1-9]\d{0,4}$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('BLOQUEADO: el procesador de pruebas requiere el emulador local');
}

const cargar = createRequire(path.resolve(__dirname, '../../funciones/package.json'));
const { initializeApp, deleteApp } = cargar('firebase-admin/app');
process.env.GCE_METADATA_HOST = '127.0.0.1:1';
const app = initializeApp({ projectId: 'demo-pos-bloque1' });
const { procesarVentaPos } = cargar('./index.cjs');

module.exports = {
  procesar: (uid, id) => procesarVentaPos.run({ params: { uid, id } }),
  cerrar: () => deleteApp(app),
};
