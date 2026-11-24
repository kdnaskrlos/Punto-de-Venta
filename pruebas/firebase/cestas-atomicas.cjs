// Prueba del presupuesto de reglas y del candidato transaccional. Solo emulador local.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { before, after, test } = require('node:test');

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:[1-9]\d{0,4}$/.test(host || '')) throw new Error('BLOQUEADO: requiere Firestore Emulator local');
const { assertFails, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const {
  collection, disableNetwork, doc, enableNetwork, getDocFromServer, getDocsFromServer,
  increment, onSnapshot, serverTimestamp, setDoc, updateDoc, deleteDoc, writeBatch,
} = require('firebase/firestore');

const proyecto = 'demo-pos-bloque1';
const reglas = readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');
const red = process.env.POS_CESTAS_REGLAS_ACTUALES === '1';
const fecha = '2026-11-24T14:00:00.000Z';
let entorno;

before(async () => {
  const [direccion, puerto] = host.split(':');
  const reglasQA = red ? reglas : reglas.replace(
    '    match /sistema/estado {', readFileSync(path.join(__dirname, 'cestas-solicitud.rules'), 'utf8') + '\n    match /sistema/estado {',
  );
  entorno = await initializeTestEnvironment({
    projectId: proyecto, firestore: { host: direccion, port: Number(puerto), rules: reglasQA },
  });
});
after(() => entorno?.cleanup());

function cliente(uid) {
  return entorno.authenticatedContext(uid).firestore();
}
function rutaSolicitud(db, uid, id) {
  return doc(db, 'usuarios', uid, 'solicitudesVentaQA', id);
}
function rutaMarca(db, uid, id) {
  return doc(db, 'usuarios', uid, 'operacionesCobro', 'venta:' + id);
}

async function sembrar(skus) {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), b = writeBatch(db);
    for (const [uid, rol] of [['a', 'vendedora'], ['b', 'admin']]) {
      b.set(doc(db, 'usuarios', uid), { uid, usuario: uid, activo: true, rol });
      b.set(doc(db, 'cajas', uid), { uid, usuario: uid, estado: 'abierta' });
    }
    for (const sku of skus) b.set(doc(db, 'productos', sku), { sku, existencia: 1 });
    await b.commit();
  });
}

function venta(id, skus, cajaId = 'a') {
  const total = skus.length * 10000;
  return { id, cajaId, fecha, subtotal: total, total, lineas: skus.map(sku => ({ sku, cantidad: 1 })),
    pagos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: total, equivalenteCop: total }] };
}

function enviarActual(db, v, marcar = true) {
  const b = writeBatch(db);
  b.set(doc(db, 'ventas', v.id), { ...v, uid: 'a', usuario: 'a', estado: 'ok', numero: null });
  if (marcar) b.set(rutaMarca(db, 'a', v.id), { que: 'venta', refId: v.id, fecha, orden: 1,
    dispositivo: 'qa-offline', estadoSync: 'confirmada_servidor' });
  b.set(doc(db, 'eventos', v.id), { id: v.id, tipo: 'venta.creada', en: serverTimestamp(), uid: 'a',
    usuario: 'a', rol: 'vendedora', ref: { col: 'ventas', id: v.id } });
  for (const { sku, cantidad } of v.lineas) {
    const id = v.id + '-' + sku;
    b.update(doc(db, 'productos', sku), { existencia: increment(-cantidad), ultimoMov: id });
    b.set(doc(db, 'movimientos', id), { id, sku, cantidad: -cantidad, motivo: 'venta', ref: v.id, usuario: 'a', fecha });
  }
  return b.commit();
}

function enviar(db, uid, v, orden = 1) {
  return setDoc(rutaSolicitud(db, uid, v.id),
    { venta: v, dispositivo: 'qa-offline', orden, recibida: serverTimestamp() });
}

async function procesar(uid, id) {
  const { procesarVenta } = require('./cestas-transaccion.cjs');
  let resultado;
  await entorno.withSecurityRulesDisabled(async ctx => { resultado = await procesarVenta(ctx.firestore(), uid, id); });
  return resultado;
}

function escrituraLocal(ref) {
  return new Promise((resolve, reject) => {
    const fin = onSnapshot(ref, { includeMetadataChanges: true }, s => {
      if (s.exists() && s.metadata.hasPendingWrites) { fin(); resolve(s.data()); }
    }, reject);
  });
}

// Cobertura de la expresión exacta que abre un movimiento por SKU. Deduplicar por ID
// elimina las reevaluaciones del emulador. Este valor es un piso, no una medición de facturación o caché.
async function movimientosConsultados(id) {
  const url = 'http://' + host + '/emulator/v1/projects/' + proyecto + ':ruleCoverage';
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  assert.ok(r.ok, 'El emulador debe exponer la cobertura de reglas');
  const reporte = await r.json();
  const fuente = reporte.rules.files[0].content;
  const inicio = fuente.indexOf('let mov = getAfter(ruta).data;') + 'let mov = '.length;
  assert.ok(inicio > 'let mov = '.length);
  const buscar = nodos => {
    for (const nodo of nodos) {
      const p = nodo.sourcePosition;
      if (p?.currentOffset === inicio
        && fuente.slice(p.currentOffset, p.endOffset + 1) === 'getAfter(ruta).data') return nodo.values;
      const dentro = buscar(nodo.children || []);
      if (dentro) return dentro;
    }
  };
  const docs = (buscar(reporte.report) || []).map(v => v.value.mapValue?.fields);
  return new Set(docs.filter(d => d?.ref?.stringValue === id).map(d => d.id.stringValue)).size;
}

test('64 SKU offline conservan un único cobro con presupuesto constante de reglas', { timeout: 45000 }, async () => {
  const skus = Array.from({ length: 64 }, (_, i) => 's' + i);
  await sembrar(skus);
  const a = cliente('a'), b = cliente('b'), id = 'presupuesto-' + randomUUID(), v = venta(id, skus);
  await disableNetwork(a);
  const local = escrituraLocal(red ? doc(a, 'ventas', id) : rutaSolicitud(a, 'a', id));
  const envio = red ? enviarActual(a, v) : enviar(a, 'a', v);
  const pendiente = await local;
  assert.equal(red ? pendiente.id : pendiente.venta.id, id);
  assert.equal((await getDocFromServer(doc(b, 'ventas', id))).exists(), false);
  await entorno.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'cajas', 'a'), { estado: 'cerrada' }));
  await enableNetwork(a);
  await envio;
  if (!red) {
    assert.equal((await getDocFromServer(doc(b, 'ventas', id))).exists(), false);
    assert.equal((await getDocFromServer(rutaMarca(a, 'a', id))).exists(), false);
    assert.equal((await procesar('a', id)).estadoSync, 'confirmada_servidor');
    assert.equal((await procesar('a', id)).estadoSync, 'confirmada_servidor');
  }
  const guardada = (await getDocFromServer(doc(a, 'ventas', id))).data();
  assert.deepEqual([guardada.cajaId, guardada.lineas.length, guardada.pagos, guardada.fecha], ['a', 64, v.pagos, fecha]);
  assert.equal((await getDocFromServer(rutaMarca(a, 'a', id))).data().estadoSync, 'confirmada_servidor');
  const stock = (await getDocsFromServer(collection(b, 'productos'))).docs.map(s => s.data().existencia);
  assert.deepEqual(stock, skus.map(() => 0));
  const movimientos = (await getDocsFromServer(collection(b, 'movimientos'))).docs.map(s => s.data());
  assert.equal(movimientos.length, 64);
  assert.deepEqual(new Set(movimientos.map(m => m.sku)), new Set(skus));
  assert.ok(movimientos.every(m => m.ref === id && m.cantidad === -1));
  assert.equal((await getDocsFromServer(collection(b, 'eventos'))).size, 1);
  const n = await movimientosConsultados(id);
  console.log('Lecturas distintas de movimientos desde las reglas de stock:', n);
  // Incluso antes de contar perfil, caja y venta, 64 accesos distintos no caben en el lote remoto.
  assert.equal(n, 0, 'la cesta debe dejar de depender de una lectura de reglas por SKU');
});

test('el último SKU insuficiente deja intacto todo el inventario y conserva el comprobante', { skip: red }, async () => {
  const skus = Array.from({ length: 24 }, (_, i) => 's' + i);
  await sembrar(skus);
  const a = cliente('a'), b = cliente('b'), v = venta('rechazada', skus);
  await updateDoc(doc(b, 'productos', skus.at(-1)), { existencia: 0 });
  await enviar(a, 'a', v);
  assert.deepEqual(await procesar('a', v.id),
    { estadoSync: 'rechazada_conflicto', motivo: 'existencia', faltantes: [skus.at(-1)] });
  const marca = (await getDocFromServer(rutaMarca(a, 'a', v.id))).data();
  assert.equal(marca.estadoSync, 'rechazada_conflicto');
  const conflicto = (await getDocFromServer(doc(b, 'conflictos', marca.conflictoId))).data();
  assert.deepEqual([conflicto.datos.pagos, conflicto.datos.lineas, conflicto.datos.cajaId], [v.pagos, v.lineas, 'a']);
  assert.equal((await getDocFromServer(doc(b, 'ventas', v.id))).exists(), false);
  assert.equal((await getDocsFromServer(collection(b, 'movimientos'))).size, 0);
  assert.equal((await getDocsFromServer(collection(b, 'eventos'))).size, 0);
  const stock = new Map((await getDocsFromServer(collection(b, 'productos'))).docs.map(s => [s.id, s.data().existencia]));
  assert.ok(skus.slice(0, -1).every(sku => stock.get(sku) === 1));
  assert.equal(stock.get(skus.at(-1)), 0);
});

test('dos operadores con cestas grandes compiten sin saldo negativo, incluso con reentrega', { skip: red, timeout: 45000 }, async () => {
  const skus = Array.from({ length: 32 }, (_, i) => 's' + i);
  await sembrar(skus);
  const a = cliente('a'), b = cliente('b');
  await Promise.all([enviar(a, 'a', venta('va', skus)), enviar(b, 'b', venta('vb', skus, 'b'))]);
  const [resultadoA, resultadoB, repetido] = await Promise.all([
    procesar('a', 'va'), procesar('b', 'vb'), procesar('a', 'va'),
  ]);
  assert.equal(repetido.estadoSync, resultadoA.estadoSync);
  const resultados = [resultadoA, resultadoB];
  assert.deepEqual(resultados.map(r => r.estadoSync).sort(), ['confirmada_servidor', 'rechazada_conflicto']);
  assert.equal((await getDocsFromServer(collection(b, 'ventas'))).size, 1);
  assert.equal((await getDocsFromServer(collection(b, 'movimientos'))).size, 32);
  assert.equal((await getDocsFromServer(collection(b, 'eventos'))).size, 1);
  const [marcaA, marcaB] = await Promise.all([getDocFromServer(rutaMarca(a, 'a', 'va')), getDocFromServer(rutaMarca(b, 'b', 'vb'))]);
  assert.deepEqual([marcaA.data().estadoSync, marcaB.data().estadoSync], resultados.map(r => r.estadoSync));
  const stock = (await getDocsFromServer(collection(b, 'productos'))).docs.map(s => s.data().existencia);
  assert.ok(stock.every(n => n === 0));
});

test('la solicitud es inmutable y el procesador comprueba perfil y caja de origen', { skip: red }, async () => {
  await sembrar(['s']);
  const a = cliente('a'), b = cliente('b'), v = venta('valida', ['s']);
  await assertFails(enviar(a, 'b', v));
  await assertFails(enviar(a, 'a', { ...v, rol: 'admin', uid: 'b' }));
  await enviar(a, 'a', v);
  await assertFails(enviar(a, 'a', v, 2));
  await assertFails(deleteDoc(rutaSolicitud(a, 'a', v.id)));
  await assertFails(getDocFromServer(rutaSolicitud(b, 'a', v.id)));
  await enviar(a, 'a', venta('ajena', ['s'], 'b'), 2);
  assert.equal((await procesar('a', 'ajena')).motivo, 'caja');

  await updateDoc(doc(b, 'usuarios', 'a'), { activo: false });
  assert.equal((await procesar('a', v.id)).motivo, 'perfil');
  assert.equal((await getDocFromServer(doc(b, 'ventas', v.id))).exists(), false);
  assert.equal((await getDocFromServer(doc(b, 'productos', 's'))).data().existencia, 1);
});

test('un cobro histórico con el mismo ID no vuelve a descontar existencias', { skip: red }, async () => {
  await sembrar(['s']);
  const a = cliente('a'), b = cliente('b');
  const v = venta('historica', ['s']);
  await enviarActual(a, v, false);
  await enviar(a, 'a', v);
  assert.equal((await procesar('a', v.id)).estadoSync, 'confirmada_servidor');
  await enviar(b, 'b', venta(v.id, ['s'], 'b'));
  assert.equal((await procesar('b', v.id)).motivo, 'id-ocupado');
  assert.equal((await getDocFromServer(doc(b, 'ventas', v.id))).data().uid, 'a');
  assert.equal((await getDocsFromServer(collection(b, 'movimientos'))).size, 1);
  assert.equal((await getDocFromServer(doc(b, 'productos', 's'))).data().existencia, 0);
});

test('las líneas del mismo SKU comparten un único descuento y movimiento', { skip: red }, async () => {
  await sembrar(['s']);
  const a = cliente('a'), b = cliente('b'), v = venta('mismo-sku', ['s', 's']);
  await updateDoc(doc(b, 'productos', 's'), { existencia: 2 });
  await enviar(a, 'a', v);
  assert.equal((await procesar('a', v.id)).estadoSync, 'confirmada_servidor');
  assert.equal((await getDocFromServer(doc(b, 'productos', 's'))).data().existencia, 0);
  const movimientos = await getDocsFromServer(collection(b, 'movimientos'));
  assert.equal(movimientos.size, 1);
  assert.equal(movimientos.docs[0].data().cantidad, -2);
});
