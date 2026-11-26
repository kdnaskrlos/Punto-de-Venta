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
const raizSdk = path.resolve(path.dirname(cargar.resolve('firebase-functions')), '../..');
const { DocumentEventData } = require(path.join(raizSdk, 'protos/compiledFirestore.js'))
  .google.events.cloud.firestore.v1;

function eventoCreado(uid, id, extensiones = {}) {
  const project = app.options.projectId;
  const document = `usuarios/${uid}/solicitudesVenta/${id}`;
  const base = `projects/${project}/databases/(default)`;
  const tiempo = { seconds: 1795528800, nanos: 0 };
  const data = DocumentEventData.encode({ value: {
    name: `${base}/documents/${document}`, createTime: tiempo, updateTime: tiempo,
  } }).finish();
  return {
    specversion: '1.0', id: 'entrega-' + id,
    type: 'google.cloud.firestore.document.v1.created',
    source: '//firestore.googleapis.com/' + base, subject: 'documents/' + document,
    project, database: '(default)', datacontenttype: 'application/protobuf',
    data: Buffer.from(data), ...extensiones,
  };
}

module.exports = {
  procesar: (uid, id) => procesarVentaPos(eventoCreado(uid, id, { document: `usuarios/${uid}/solicitudesVenta/${id}` })),
  eventoCreado,
  entregar: evento => procesarVentaPos(evento),
  cerrar: () => deleteApp(app),
};
