const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { warn } = require('firebase-functions/logger');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { atenderVenta, idValido } = require('./ventas.cjs');

const proyectoEntorno = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'punto-de-venta-comic-shop';
const app = getApps()[0] || (process.env.FIREBASE_CONFIG ? initializeApp() : initializeApp({ projectId: proyectoEntorno }));
const proyecto = app.options.projectId || proyectoEntorno;
const proyectoPos = ['punto-de-venta-comic-shop', '570684941224'];
const proyectos = new Set(proyectoPos.includes(proyecto) ? proyectoPos : [proyecto]);
const basePredeterminada = '(default)';
const tipoCreacion = 'google.cloud.firestore.document.v1.created';

function coincideRuta(referencia, ruta) {
  if (referencia === ruta) return true;
  const partes = referencia.split('/');
  const esperadas = ruta.split('/');
  try {
    return partes.length === esperadas.length
      && partes.every((parte, i) => decodeURIComponent(parte) === esperadas[i]);
  } catch {
    return false;
  }
}

function solicitudDelEvento(evento) {
  if (evento.type !== tipoCreacion) return { motivo: 'tipo_evento' };

  // Eventarc usa un nombre de recurso. El SDK también representa el recurso
  // sin autoridad y, en ocasiones, con la ruta del documento al final.
  const origen = typeof evento.source === 'string' ? evento.source.replace(/^\/\/firestore\.googleapis\.com\//, '') : '';
  const [projects, proyectoOrigen, databases, baseOrigen, documents, ...rutaOrigen] = origen.split('/');
  if (projects !== 'projects' || databases !== 'databases'
    || (documents !== undefined && documents !== 'documents')) return { motivo: 'formato_origen' };
  if (!proyectos.has(proyectoOrigen) || (evento.project !== undefined && !proyectos.has(evento.project))) {
    return { motivo: 'proyecto' };
  }
  if (baseOrigen !== basePredeterminada && baseOrigen !== '%28default%29') return { motivo: 'base_origen' };
  if (evento.database !== undefined && evento.database !== basePredeterminada) return { motivo: 'base_extension' };
  // La base nativa no usa namespaces. El transporte puede omitirlo o enviarlo vacío.
  if (evento.namespace !== undefined && evento.namespace !== '' && evento.namespace !== basePredeterminada) {
    return { motivo: 'namespace' };
  }

  // El SDK obtiene params de la extensión document. El snapshot contiene la ruta
  // concreta del protobuf aunque esa extensión no venga en la entrega.
  const ruta = evento.data?.ref?.path;
  if (!evento.data?.exists || typeof ruta !== 'string') return { motivo: 'snapshot_ausente' };
  const partes = ruta.split('/');
  const [coleccion, uid, subcoleccion, id] = partes;
  if (partes.length !== 4 || coleccion !== 'usuarios' || subcoleccion !== 'solicitudesVenta'
    || !idValido(uid) || !idValido(id)) return { motivo: 'ruta_snapshot' };
  if (rutaOrigen.length && !coincideRuta(rutaOrigen.join('/'), ruta)) return { motivo: 'ruta_origen' };
  if (evento.subject !== undefined && (typeof evento.subject !== 'string'
    || !coincideRuta(evento.subject.replace(/^documents\//, ''), ruta))) return { motivo: 'subject' };
  return { uid, id };
}

exports.procesarVentaPos = onDocumentCreated({
  document: 'usuarios/{uid}/solicitudesVenta/{id}',
  region: process.env.POS_REGION_FUNCIONES || 'us-central1',
  retry: true,
}, async event => {
  const solicitud = solicitudDelEvento(event);
  if (solicitud.motivo) {
    warn('procesarVentaPos ignoró un CloudEvent con origen o documento inválido.', { motivo: solicitud.motivo });
    return;
  }
  return atenderVenta(getFirestore(app), solicitud);
});
