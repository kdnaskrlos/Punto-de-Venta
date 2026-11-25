// Prueba exclusivamente contra Firebase remoto de QA. No imprime credenciales.
'use strict';
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { setTimeout: esperar } = require('node:timers/promises');

const projectId = process.env.POS_QA_PROJECT_ID || '';
// Proyecto nuevo de QA o Firebase existente expresamente autorizado por el propietario.
// La segunda ruta exige confirmación exacta para impedir que una variable mal escrita
// ejecute lotes sintéticos contra cualquier otro proyecto.
const proyectoQA = /^pos-qa-[a-z0-9-]{4,}$/.test(projectId);
const proyectoExistenteAutorizado = projectId === 'punto-de-venta-comic-shop'
  && process.env.POS_QA_ALLOW_EXISTING_PROJECT === projectId
  && process.env.POS_QA_CONFIRM_NONOPERATIVE === 'SI_POS_NO_OPERATIVO';
if (!proyectoQA && !proyectoExistenteAutorizado) {
  throw new Error('BLOQUEADO: proyecto no autorizado para pruebas remotas; exige confirmación explícita del Firebase existente.');
}
for (const key of ['POS_QA_API_KEY', 'POS_QA_EMAIL', 'POS_QA_PASSWORD']) {
  if (!process.env[key]) throw new Error('BLOQUEADO: falta ' + key);
}
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('BLOQUEADO: esta prueba requiere Firestore y Auth remotos.');
}
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, doc, writeBatch, getDocFromServer, setDoc, increment, serverTimestamp, runTransaction } = require('firebase/firestore');
const app = initializeApp({ projectId, apiKey: process.env.POS_QA_API_KEY, authDomain: projectId + '.firebaseapp.com' });
const auth = getAuth(app), db = getFirestore(app);
const fecha = new Date().toISOString();
const base = 'qa-' + randomUUID().replace(/-/g, '').slice(0, 16);
const procesadas = process.env.POS_QA_VENTAS_PROCESADAS === '1';
const firma = (...partes) => createHash('sha256').update(JSON.stringify(partes)).digest('hex');

async function confirmar(marca) {
  const tope = Date.now() + 45000;
  while (Date.now() < tope) {
    const s = await getDocFromServer(marca);
    if (s.exists()) return s.data();
    await esperar(500);
  }
  throw new Error('Estado indeterminado. El procesador no escribió una marca a tiempo para ' + marca.id);
}

async function cesta({ uid, usuario, idCaja, n, falta }) {
  const ventaId = base + '-v-' + n + (falta ? '-faltante' : '');
  const skus = Array.from({ length: n }, (_, i) => ventaId + '-s-' + i);
  const preparar = writeBatch(db);
  for (const [i, sku] of skus.entries()) preparar.set(doc(db, 'productos', sku),
    { sku, existencia: falta && i === n - 1 ? 0 : 1, activo: true, nombre: 'QA prueba de capacidad', precios: [10000, 10000, 10000, 10000, 10000] });
  await preparar.commit();

  const { calcularCarrito } = await import('../../js/nucleo/tramos.js');
  const { comisionesVenta } = await import('../../js/nucleo/comisiones.js');
  const catalogo = Object.fromEntries(skus.map(sku => [sku, { precios: [10000, 10000, 10000, 10000, 10000] }]));
  const calculo = calcularCarrito(skus.map(sku => ({ sku, cantidad: 1 })), catalogo);
  const comisiones = comisionesVenta(calculo.lineas, catalogo);
  const venta = { id: ventaId, cajaId: idCaja, fecha, creada: fecha, offline: false,
    subtotal: 10000 * n, total: 10000 * n,
    lineas: calculo.lineas.map((l, i) => ({ ...l, descuento: 0, comision: comisiones[i].comision, reducida: false })),
    pagos: [{ forma: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP', monto: 10000 * n, equivalenteCop: 10000 * n }] };
  const marca = doc(db, 'usuarios', uid, 'operacionesCobro', 'venta:' + ventaId);
  const eventoId = procesadas ? firma(uid, ventaId, 'venta.creada') : ventaId + '-evento';
  const movimientos = skus.map((sku, i) => procesadas ? firma(ventaId, sku) : ventaId + '-mov-' + i);
  let aceptada = true, error = null;
  if (procesadas) {
    await setDoc(doc(db, 'usuarios', uid, 'solicitudesVenta', ventaId),
      { venta, dispositivo: 'qa-remoto', orden: n, version: 'v2.43', recibida: serverTimestamp() });
    const res = await confirmar(marca);
    aceptada = res.estadoSync === 'confirmada_servidor';
    if (!aceptada) {
      assert.equal(res.estadoSync, 'rechazada_conflicto');
      const conflicto = (await getDocFromServer(doc(db, 'conflictos', res.conflictoId))).data();
      error = conflicto?.motivo;
      if (falta) assert.deepEqual([error, conflicto.faltantes, conflicto.datos.pagos], ['existencia', [skus.at(-1)], venta.pagos]);
    }
  } else {
    const lote = writeBatch(db);
    lote.set(doc(db, 'ventas', ventaId), { ...venta, usuario, uid, estado: 'ok', numero: null });
    lote.set(marca, { que: 'venta', refId: ventaId, fecha, dispositivo: 'qa-remoto', orden: n,
      apartadoId: null, estadoSync: 'confirmada_servidor' });
    lote.set(doc(db, 'eventos', eventoId), { id: eventoId, uid, usuario, rol: 'admin', dispositivo: 'qa-remoto',
      en: serverTimestamp(), fecha, tipo: 'venta.creada', ref: { col: 'ventas', id: ventaId } });
    for (const [i, sku] of skus.entries()) {
      const movId = movimientos[i];
      lote.update(doc(db, 'productos', sku), { existencia: increment(-1), ultimoMov: movId });
      lote.set(doc(db, 'movimientos', movId), { id: movId, sku, cantidad: -1, motivo: 'venta', ref: ventaId, nota: '', usuario, fecha });
    }
    try { await lote.commit(); } catch (e) { aceptada = false; error = e.code || e.message; }
  }
  const [productos, guardada, resultado, evento, movs] = await Promise.all([
    Promise.all(skus.map(sku => getDocFromServer(doc(db, 'productos', sku)))),
    getDocFromServer(doc(db, 'ventas', ventaId)), getDocFromServer(marca), getDocFromServer(doc(db, 'eventos', eventoId)),
    Promise.all(movimientos.map(id => getDocFromServer(doc(db, 'movimientos', id)))),
  ]);
  assert.equal(guardada.exists(), aceptada);
  assert.equal(evento.exists(), aceptada);
  assert.equal(resultado.exists(), procesadas || aceptada);
  for (const [i, p] of productos.entries()) {
    assert.equal(p.data()?.existencia, aceptada || (falta && i === n - 1) ? 0 : 1);
    if (aceptada) {
      const mov = movs[i].data();
      assert.deepEqual([mov?.ref, mov?.sku, mov?.cantidad, p.data().ultimoMov], [ventaId, skus[i], -1, movs[i].id]);
    } else assert.equal(movs[i].exists(), false);
  }
  if (aceptada) assert.deepEqual([guardada.data().cajaId, guardada.data().pagos], [idCaja, venta.pagos]);
  return { sku: n, falta, aceptada, error };
}

async function main() {
  const { user: { uid } } = await signInWithEmailAndPassword(auth, process.env.POS_QA_EMAIL, process.env.POS_QA_PASSWORD);
  const perfil = (await getDocFromServer(doc(db, 'usuarios', uid))).data();
  assert.ok(perfil?.activo === true && perfil.rol === 'admin' && typeof perfil.usuario === 'string',
    'Se requiere una cuenta admin de QA con perfil activo.');
  const { usuario } = perfil, idCaja = base + '-caja';
  const caja = doc(db, 'cajas', idCaja), puntero = doc(db, 'cajaAbierta', usuario);
  // No reemplazar una caja abierta del administrador existente ni alterar una caja comercial.
  const punteroPrevio = await getDocFromServer(puntero);
  if (punteroPrevio.exists()) {
    throw new Error('BLOQUEADO: el administrador tiene una caja abierta. Ciérrala antes de probar; no se sobrescribe.');
  }
  // Diagnóstico sin escrituras: comprueba autenticación, perfil y caja.
  // La contraseña no aparece en la salida, y no se consultan datos personales.
  if (process.env.POS_QA_SOLO_PRECHECK === '1') {
    console.log(JSON.stringify({
      modo: 'solo-lectura', proyecto: projectId, adminActivo: true,
      cajaAbierta: false, ventasEjecutadas: 0, listoParaPrepararMatriz: true,
    }));
    return;
  }
  if (process.env.POS_QA_CONFIRM_WRITES !== 'SI_DATOS_SINTETICOS') {
    throw new Error('BLOQUEADO: falta POS_QA_CONFIRM_WRITES=SI_DATOS_SINTETICOS para autorizar escrituras sintéticas.');
  }
  const abrir = writeBatch(db);
  abrir.set(puntero, { cajaId: idCaja, desde: fecha });
  abrir.set(caja, { id: idCaja, uid, usuario, estado: 'abierta', tipo: 'tienda', abierta: fecha, fondo: {}, movimientos: [] });
  await abrir.commit();
  try {
    const cantidades = [1, 8, 10, 12, 15, 16, 17, 18, 19, 20, 21, 24, 30, 32, 48, 64];
    if (procesadas) cantidades.push(128, 248);
    const resultados = [];
    for (const n of cantidades) {
      const resultado = await cesta({ uid, usuario, idCaja, n, falta: false });
      resultados.push(resultado);
      console.log(JSON.stringify(resultado));
    }
    if (procesadas) assert.equal((await cesta({ uid, usuario, idCaja, n: 64, falta: true })).aceptada, false);
    assert.equal(resultados[0].aceptada, true, 'Ni siquiera 1 SKU se confirmó');
    if (resultados.some(r => !r.aceptada)) process.exitCode = 2;
    console.log('Proyecto QA y prefijo sintético', projectId, base);
  } finally {
    await runTransaction(db, async tx => {
      const [actual, origen] = await Promise.all([tx.get(puntero), tx.get(caja)]);
      if (origen.data()?.estado === 'cerrada' && actual.data()?.cajaId !== idCaja) return;
      if (actual.data()?.cajaId !== idCaja || origen.data()?.uid !== uid || origen.data()?.estado !== 'abierta') {
        throw new Error('BLOQUEADO: cambió la caja de la prueba. Revisa solo la caja sintética ' + idCaja);
      }
      tx.delete(puntero);
      tx.update(caja, { estado: 'cerrada', cierre: { fecha: new Date().toISOString() } });
    });
  }
}

main().catch(e => { process.exitCode = 1; console.error('BLOQUEADO/FALLO', e.code || e.message); }).finally(async () => {
  try { await signOut(auth); } finally { await deleteApp(app); }
});
