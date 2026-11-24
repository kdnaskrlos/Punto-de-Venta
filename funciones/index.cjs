const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { atenderVenta } = require('./ventas.cjs');

const app = getApps()[0] || initializeApp();

exports.procesarVentaPos = onDocumentCreated({
  document: 'usuarios/{uid}/solicitudesVenta/{id}',
  region: process.env.POS_REGION_FUNCIONES || 'us-central1',
  retry: true,
}, async event => {
  return atenderVenta(getFirestore(app), event.params);
});
