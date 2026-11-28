const { cloudEvent } = require('@google-cloud/functions-framework');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { parse } = require('protobufjs');
const { atenderVenta, idValido } = require('./ventas.cjs');
const { atenderApartado } = require('./apartados.cjs');

const proyectoEntorno = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'punto-de-venta-comic-shop';
const app = getApps()[0] || (process.env.FIREBASE_CONFIG ? initializeApp() : initializeApp({ projectId: proyectoEntorno }));
const proyecto = app.options.projectId || proyectoEntorno;
const proyectoPos = ['punto-de-venta-comic-shop', '570684941224'];
const proyectos = new Set(proyectoPos.includes(proyecto) ? proyectoPos : [proyecto]);
const base = '(default)';
const tipoCreacion = 'google.cloud.firestore.document.v1.created';
const patron = 'usuarios/{uid}/solicitudesVenta/{id}';

// Proyección de google.events.cloud.firestore.v1.DocumentEventData y Document.
// El decodificador salta los campos restantes. El cobro relee la solicitud en Firestore.
const documentoEvento = parse(`
  syntax = "proto3";
  message Document { string name = 1; }
  message DocumentEventData { Document value = 1; }
`).root.lookupType('DocumentEventData');

function solicitudDelEvento(evento) {
  if (evento?.type !== tipoCreacion) return { motivo: 'tipo_evento' };

  const origen = typeof evento.source === 'string' ? evento.source : '';
  const autoridad = /^(?:https:)?\/\/firestore\.googleapis\.com(?:\/|$)/;
  if (!autoridad.test(origen) && !origen.startsWith('projects/')) return { motivo: 'formato_origen' };
  const [projects, proyectoOrigen, databases, baseOrigen] = origen.replace(autoridad, '').split('/');
  if (projects === 'projects' && !proyectos.has(proyectoOrigen)) return { motivo: 'proyecto_origen' };
  if (databases === 'databases' && baseOrigen !== base && baseOrigen !== '%28default%29') {
    return { motivo: 'base_origen' };
  }

  let datos = evento.data;
  try {
    if (datos instanceof Uint8Array) datos = documentoEvento.decode(datos);
    else if (datos === undefined && typeof evento.data_base64 === 'string') {
      datos = documentoEvento.decode(Buffer.from(evento.data_base64, 'base64'));
    }
  } catch {
    return { motivo: 'protobuf_invalido' };
  }
  const nombre = datos?.value?.name;
  if (typeof nombre !== 'string' || !nombre) return { motivo: 'documento_ausente' };

  // Las extensiones document, database, namespace y subject son del transporte.
  // La identidad que se procesa es el nombre completo del documento recién creado.
  const partes = nombre.split('/');
  const [prefijo, proyectoDocumento, bases, baseDocumento, documentos, usuarios, uid, solicitudes, id] = partes;
  if (partes.length !== 9 || prefijo !== 'projects' || bases !== 'databases' || documentos !== 'documents'
    || usuarios !== 'usuarios' || solicitudes !== 'solicitudesVenta' || !idValido(uid) || !idValido(id)) {
    return { motivo: 'ruta_documento' };
  }
  if (!proyectos.has(proyectoDocumento)) return { motivo: 'proyecto_documento' };
  if (baseDocumento !== base) return { motivo: 'base_documento' };
  return { uid, id };
}

async function procesarVentaPos(evento) {
  const solicitud = solicitudDelEvento(evento);
  if (solicitud.motivo) {
    console.warn(JSON.stringify({ severity: 'WARNING', message: 'CloudEvent de venta rechazado.', motivo: solicitud.motivo }));
    return;
  }
  const db = getFirestore(app);
  if (/^(apartado|abono|completar):/.test(solicitud.id)) {
    const doc = await db.doc(`usuarios/${solicitud.uid}/solicitudesVenta/${solicitud.id}`).get();
    if (doc.data()?.cobro) return atenderApartado(db, solicitud);
  }
  return atenderVenta(db, solicitud);
}

cloudEvent('procesarVentaPos', procesarVentaPos);
// Firebase CLI descubre el disparador por su descriptor. La entrega usa el manejador nativo.
procesarVentaPos.__endpoint = onDocumentCreated({
  document: patron, region: process.env.POS_REGION_FUNCIONES || 'us-central1', retry: true,
}, procesarVentaPos).__endpoint;
exports.procesarVentaPos = procesarVentaPos;
