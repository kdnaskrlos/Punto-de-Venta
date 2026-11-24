// Prueba EXCLUSIVAMENTE contra un proyecto Firebase remoto de QA; nunca producción.
// El código no recibe credenciales por argumentos ni las imprime; exige variables de entorno.
// Requiere un usuario Auth de QA con documento usuarios/{uid} activo/rol admin previamente creado.
// NODE_PATH=/ruta/node_modules POS_QA_PROJECT_ID=pos-qa-... POS_QA_API_KEY=... POS_QA_EMAIL=... POS_QA_PASSWORD=... node pruebas/firebase/remoto-cestas.cjs
'use strict';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const projectId = process.env.POS_QA_PROJECT_ID || '';
if (!/^pos-qa-[a-z0-9-]{4,}$/.test(projectId) || projectId === 'punto-de-venta-comic-shop') {
  throw new Error('BLOQUEADO: exige POS_QA_PROJECT_ID independiente, con prefijo pos-qa-; no usar producción.');
}
for (const key of ['POS_QA_API_KEY', 'POS_QA_EMAIL', 'POS_QA_PASSWORD']) {
  if (!process.env[key]) throw new Error('BLOQUEADO: falta ' + key);
}
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('BLOQUEADO: esta prueba debe alcanzar Firestore y Auth remotos, no emuladores.');
}
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, doc, writeBatch, getDocFromServer, increment, serverTimestamp } = require('firebase/firestore');
const app = initializeApp({ projectId, apiKey: process.env.POS_QA_API_KEY, authDomain: projectId + '.firebaseapp.com' });
const auth = getAuth(app), db = getFirestore(app);
const fecha = new Date().toISOString();
const base = 'qa-' + randomUUID().replace(/-/g, '').slice(0, 16);
const cantidades = [1, 8, 12, 16, 17, 18, 19, 20, 21, 24, 32, 48, 64];

async function main() {
  const cred = await signInWithEmailAndPassword(auth, process.env.POS_QA_EMAIL, process.env.POS_QA_PASSWORD);
  const perfil = await getDocFromServer(doc(db, 'usuarios', cred.user.uid));
  assert.ok(perfil.exists() && perfil.data().activo === true && perfil.data().rol === 'admin',
    'La cuenta de prueba debe tener perfil admin activo en un proyecto QA independiente.');
  const usuario = perfil.data().usuario;
  assert.ok(typeof usuario === 'string' && usuario.length);
  const idCaja = base + '-caja';
  const caja = writeBatch(db);
  caja.set(doc(db, 'cajaAbierta', usuario), { cajaId: idCaja, desde: fecha });
  caja.set(doc(db, 'cajas', idCaja), { id: idCaja, uid: cred.user.uid, usuario, estado: 'abierta', tipo: 'tienda', abierta: fecha, fondo: {}, movimientos: [] });
  try { await caja.commit(); } catch (e) { throw new Error('No se pudo abrir caja QA; la cuenta no debe tener otra caja abierta: ' + (e.code || e.message)); }
  const resultados = [];
  for (const n of cantidades) {
    const ventaId = base + '-v-' + n;
    const skus = Array.from({length:n}, (_,i) => base + '-s-' + n + '-' + i);
    const preparar = writeBatch(db);
    skus.forEach(sku => preparar.set(doc(db, 'productos', sku), { sku, existencia: 1, activo: true, nombre: 'QA prueba de capacidad' }));
    await preparar.commit();
    const lote = writeBatch(db);
    lote.set(doc(db, 'ventas', ventaId), {
      id: ventaId, usuario, uid: cred.user.uid, cajaId: idCaja, estado: 'ok', numero: null,
      fecha, creada: fecha, subtotal: 10000 * n, total: 10000 * n,
      lineas: skus.map(sku => ({sku, cantidad:1, precioUnit:10000, subtotal:10000})),
      pagos: [{ forma:'efectivo-cop', moneda:'COP', monto:10000*n, equivalenteCop:10000*n }],
    });
    lote.set(doc(db, 'usuarios', cred.user.uid, 'operacionesCobro', 'venta:' + ventaId), {
      que:'venta', refId:ventaId, fecha, dispositivo:'qa-remoto', orden:n,
      apartadoId:null, estadoSync:'confirmada_servidor',
    });
    const eventoId = ventaId + '-evento';
    lote.set(doc(db, 'eventos', eventoId), {
      id: eventoId, uid: cred.user.uid, usuario, rol: perfil.data().rol, dispositivo: 'qa-remoto',
      en: serverTimestamp(), fecha, tipo: 'venta.creada', ref: { col: 'ventas', id: ventaId },
    });
    const movimientos = skus.map((_, i) => base + '-mov-' + n + '-' + i);
    skus.forEach((sku,i) => {
      const movId = movimientos[i];
      lote.update(doc(db, 'productos', sku), { existencia:increment(-1), ultimoMov:movId });
      lote.set(doc(db, 'movimientos', movId), {
        id:movId, sku, cantidad:-1, motivo:'venta', ref:ventaId, nota:'', usuario, fecha,
      });
    });
    let aceptado=true, error=null;
    try { await lote.commit(); } catch (e) { aceptado=false; error=e.code || e.message; }
    const [productoSnap, ventaSnap, marcaSnap, eventoSnap, movSnaps] = await Promise.all([
      Promise.all(skus.map(sku => getDocFromServer(doc(db, 'productos', sku)))),
      getDocFromServer(doc(db, 'ventas', ventaId)),
      getDocFromServer(doc(db, 'usuarios', cred.user.uid, 'operacionesCobro', 'venta:' + ventaId)),
      getDocFromServer(doc(db, 'eventos', eventoId)),
      Promise.all(movimientos.map(id => getDocFromServer(doc(db, 'movimientos', id)))),
    ]);
    const stockCorrecto = productoSnap.every(x => x.exists() && x.data().existencia === (aceptado ? 0 : 1));
    const movimientosCorrectos = movSnaps.every((snap, i) => {
      if (!aceptado) return !snap.exists();
      const mov = snap.data();
      return mov?.ref === ventaId && mov.sku === skus[i] && mov.cantidad === -1
        && productoSnap[i].data()?.ultimoMov === snap.id;
    });
    const correcto = stockCorrecto && movimientosCorrectos
      && ventaSnap.exists() === aceptado && marcaSnap.exists() === aceptado
      && eventoSnap.exists() === aceptado;
    assert.ok(correcto, 'INTEGRIDAD ROTA: cesta ' + n + ' escrituras parciales');
    resultados.push({ sku:n, estado:aceptado?'ACEPTADA':'RECHAZADA ATÓMICAMENTE', error });
    console.log('SKU', n, '=>', aceptado ? 'ACEPTADA' : 'RECHAZADA ATÓMICAMENTE', error || '');
  }
  assert.ok(resultados[0].estado==='ACEPTADA', 'Ni siquiera una cesta de 1 SKU pudo operar en QA.');
  console.log('RESULTADO QA remoto:', JSON.stringify(resultados));
  console.log('Proyecto de QA usado:', projectId, 'identificador de datos sintéticos:', base);
  if (resultados.some(x=>x.estado!=='ACEPTADA')) {
    process.exitCode=2; // falla de capacidad, no corrupción; revisar diseño antes de integrar a main
    console.error('CAPACIDAD NO VALIDADA: hay cestas rechazadas; no fusionar esta PR como cobertura ilimitada.');
  }
}
main().catch(e=>{ process.exitCode=1; console.error('BLOQUEADO/FALLO: ',e.code||e.message); }).finally(async()=>{
  try { await signOut(auth); } catch {}
  await deleteApp(app).catch(()=>{});
});
