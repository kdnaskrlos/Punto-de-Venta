const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { warn } = require('firebase-functions/logger');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { atenderVenta, idValido } = require('./ventas.cjs');

const proyectoEntorno = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'punto-de-venta-comic-shop';
const app = getApps()[0] || (process.env.FIREBASE_CONFIG ? initializeApp() : initializeApp({ projectId: proyectoEntorno }));
const proyecto = app.options.projectId || proyectoEntorno;
const origen = `//firestore.googleapis.com/projects/${proyecto}/databases/(default)`;

function solicitudDelEvento(evento) {
  if (evento.type !== 'google.cloud.firestore.document.v1.created' || evento.source !== origen
    || (evento.project !== undefined && evento.project !== proyecto)
    || (evento.database !== undefined && evento.database !== '(default)')
    || (evento.namespace !== undefined && evento.namespace !== '(default)')) return null;

  // El SDK obtiene params de la extensión document. El snapshot contiene la ruta
  // concreta del protobuf aunque esa extensión no venga en la entrega.
  const ruta = evento.data?.ref?.path;
  if (!evento.data?.exists || typeof ruta !== 'string'
    || (evento.subject !== undefined && evento.subject !== 'documents/' + ruta)) return null;
  const partes = ruta.split('/');
  const [coleccion, uid, subcoleccion, id] = partes;
  if (partes.length !== 4 || coleccion !== 'usuarios' || subcoleccion !== 'solicitudesVenta'
    || !idValido(uid) || !idValido(id)) return null;
  return { uid, id };
}

exports.procesarVentaPos = onDocumentCreated({
  document: 'usuarios/{uid}/solicitudesVenta/{id}',
  region: process.env.POS_REGION_FUNCIONES || 'us-central1',
  retry: true,
}, async event => {
  const solicitud = solicitudDelEvento(event);
  if (!solicitud) {
    warn('procesarVentaPos ignoró un CloudEvent con origen o documento inválido.', { cloudEventId: event.id });
    return;
  }
  return atenderVenta(getFirestore(app), solicitud);
});
