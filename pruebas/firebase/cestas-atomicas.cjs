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
const { procesar, eventoCreado, entregar, cerrar } = require('./servicio-ventas.cjs');
const red = process.env.POS_CESTAS_REGLAS_ACTUALES === '1';
const disparador = process.env.POS_CESTAS_DISPARADOR_LOCAL === '1';
const fecha = '2026-11-24T14:00:00.000Z';
let entorno;

before(async () => {
  const [direccion, puerto] = host.split(':');
  entorno = await initializeTestEnvironment({
    projectId: proyecto, firestore: { host: direccion, port: Number(puerto), rules: reglas },
  });
});
after(async () => { await entorno?.cleanup(); await cerrar(); });

function cliente(uid) {
  return entorno.authenticatedContext(uid).firestore();
}
function rutaSolicitud(db, uid, id) {
  return doc(db, 'usuarios', uid, 'solicitudesVenta', id);
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
    for (const sku of skus) b.set(doc(db, 'productos', sku), { sku, existencia: 1, precios: [10000, 10000, 10000, 10000, 10000] });
    await b.commit();
  });
}

function venta(id, skus, cajaId = 'a') {
  const n = skus.length;
  const importe = n >= 24 ? n * 1000 : Math.max(n * (n >= 12 ? 1000 : n >= 6 ? 2000 : 4000), n >= 12 ? 22000 : n >= 6 ? 20000 : 0);
  const comisiones = skus.map((_, i) => i === n - 1 ? importe - Math.floor(importe / n) * (n - 1) : Math.floor(importe / n));
  const total = skus.length * 10000;
  return { id, cajaId, fecha, creada: fecha, offline: true, subtotal: total, total, lineas: skus.map((sku, i) => ({ sku, cantidad: 1, tramo: [1, 6, 12, 24, 48].filter(n => skus.length >= n).length - 1, precioUnit: 10000, subtotal: 10000, oferta: false, descuento: 0, comision: comisiones[i], reducida: false })),
    pagos: [{ forma: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP', monto: total, equivalenteCop: total }] };
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
    { venta: v, dispositivo: 'qa-offline', orden, version: 'v2.43', recibida: serverTimestamp() });
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
  if (disparador) {
    // El evento debe salir del emulador de Firestore y llegar al emulador de Functions.
    let quitar = () => {};
    let reloj;
    try {
      await new Promise((resolve, reject) => {
        reloj = setTimeout(() => reject(new Error('El disparador local no numeró la venta')), 15000);
        quitar = onSnapshot(doc(a, 'ventas', id), s => { if (s.data()?.numero) resolve(); }, reject);
      });
    } finally { clearTimeout(reloj); quitar(); }
  } else if (!red) {
    assert.equal((await getDocFromServer(doc(b, 'ventas', id))).exists(), false);
    assert.equal((await getDocFromServer(rutaMarca(a, 'a', id))).exists(), false);
    assert.equal(await procesar('a', id), 'confirmada_servidor');
    assert.equal(await procesar('a', id), 'confirmada_servidor');
  }
  const guardada = (await getDocFromServer(doc(a, 'ventas', id))).data();
  if (!red) assert.equal(guardada.numero, 'V-0001');
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

test('reentrega de Eventarc sin extensión document recupera la solicitud original una sola vez', { skip: red || disparador }, async () => {
  const id = 'qa-v243-20261126-79dcb917', sku = id + '-sku';
  await sembrar([sku]);
  const a = cliente('a'), b = cliente('b'), v = venta(id, [sku]);
  await entorno.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'cajas', 'a'), { estado: 'cerrada' }));
  await enviar(a, 'a', v);
  const solicitud = rutaSolicitud(a, 'a', id), marca = rutaMarca(a, 'a', id), guardada = doc(a, 'ventas', id);
  const original = (await getDocFromServer(solicitud)).data();
  assert.equal((await getDocFromServer(guardada)).exists(), false);
  assert.equal((await getDocFromServer(marca)).exists(), false);

  const evento = eventoCreado('a', id, { project: undefined });
  const invalidos = [
    { ...evento, source: evento.source.replace(proyecto, 'otro-proyecto') },
    { ...evento, source: evento.source.replace('(default)', 'otra-base') },
    { ...evento, project: 'otro-proyecto' },
    { ...evento, namespace: 'otro-namespace' },
    { ...evento, type: 'google.cloud.firestore.document.v1.updated' },
    { ...evento, subject: `documents/usuarios/b/solicitudesVenta/${id}` },
    { ...evento, subject: `documents/usuarios/a/solicitudesVenta/${id}/extra` },
    { ...evento, data: undefined },
    eventoCreado('__reservado__', id),
    eventoCreado('a', '__reservado__'),
  ];
  for (const invalido of invalidos) assert.equal(await entregar(invalido), undefined);
  assert.equal((await getDocFromServer(guardada)).exists(), false);
  assert.equal((await getDocFromServer(marca)).exists(), false);
  assert.equal((await getDocFromServer(doc(a, 'productos', sku))).data().existencia, 1);

  assert.equal(await entregar(evento), 'confirmada_servidor');
  assert.equal(await entregar(evento), 'confirmada_servidor');
  assert.equal(await entregar({ ...evento, subject: undefined }), 'confirmada_servidor');
  assert.deepEqual((await getDocFromServer(solicitud)).data(), original);
  assert.equal((await getDocFromServer(marca)).data().refId, id);
  const final = (await getDocFromServer(guardada)).data();
  assert.deepEqual([final.id, final.pagos, final.numero], [id, v.pagos, 'V-0001']);
  assert.equal((await getDocFromServer(doc(a, 'contadores', 'ventas'))).data().n, 1);
  assert.equal((await getDocFromServer(doc(a, 'productos', sku))).data().existencia, 0);
  assert.equal((await getDocsFromServer(collection(b, 'ventas'))).size, 1);
  assert.equal((await getDocsFromServer(collection(b, 'movimientos'))).size, 1);
  assert.equal((await getDocsFromServer(collection(b, 'eventos'))).size, 1);
});

test('el último SKU insuficiente deja intacto todo el inventario y conserva el comprobante', { skip: red || disparador }, async () => {
  const skus = Array.from({ length: 24 }, (_, i) => 's' + i);
  await sembrar(skus);
  const a = cliente('a'), b = cliente('b'), v = venta('rechazada', skus);
  await updateDoc(doc(b, 'productos', skus.at(-1)), { existencia: 0 });
  await enviar(a, 'a', v);
  assert.equal(await procesar('a', v.id), 'rechazada_conflicto');
  const marca = (await getDocFromServer(rutaMarca(a, 'a', v.id))).data();
  assert.equal(marca.estadoSync, 'rechazada_conflicto');
  const conflicto = (await getDocFromServer(doc(b, 'conflictos', marca.conflictoId))).data();
  assert.deepEqual([conflicto.motivo, conflicto.faltantes], ['existencia', [skus.at(-1)]]);
  assert.deepEqual([conflicto.datos.pagos, conflicto.datos.lineas, conflicto.datos.cajaId], [v.pagos, v.lineas, 'a']);
  assert.equal((await getDocFromServer(doc(b, 'ventas', v.id))).exists(), false);
  assert.equal((await getDocsFromServer(collection(b, 'movimientos'))).size, 0);
  const eventos = (await getDocsFromServer(collection(b, 'eventos'))).docs.map(s => s.data().tipo);
  assert.deepEqual(eventos, ['conflicto.registrado']);
  const stock = new Map((await getDocsFromServer(collection(b, 'productos'))).docs.map(s => [s.id, s.data().existencia]));
  assert.ok(skus.slice(0, -1).every(sku => stock.get(sku) === 1));
  assert.equal(stock.get(skus.at(-1)), 0);
});

test('dos operadores con cestas grandes compiten sin saldo negativo, incluso con reentrega', { skip: red || disparador, timeout: 45000 }, async () => {
  const skus = Array.from({ length: 32 }, (_, i) => 's' + i);
  await sembrar(skus);
  const a = cliente('a'), b = cliente('b');
  await Promise.all([enviar(a, 'a', venta('va', skus)), enviar(b, 'b', venta('vb', skus, 'b'))]);
  const [resultadoA, resultadoB, repetido] = await Promise.all([
    procesar('a', 'va'), procesar('b', 'vb'), procesar('a', 'va'),
  ]);
  assert.equal(repetido, resultadoA);
  const resultados = [resultadoA, resultadoB];
  assert.deepEqual([...resultados].sort(), ['confirmada_servidor', 'rechazada_conflicto']);
  assert.equal((await getDocsFromServer(collection(b, 'ventas'))).size, 1);
  assert.equal((await getDocsFromServer(collection(b, 'movimientos'))).size, 32);
  assert.equal((await getDocsFromServer(collection(b, 'eventos'))).size, 2);
  const [marcaA, marcaB] = await Promise.all([getDocFromServer(rutaMarca(a, 'a', 'va')), getDocFromServer(rutaMarca(b, 'b', 'vb'))]);
  assert.deepEqual([marcaA.data().estadoSync, marcaB.data().estadoSync], resultados);
  const stock = (await getDocsFromServer(collection(b, 'productos'))).docs.map(s => s.data().existencia);
  assert.ok(stock.every(n => n === 0));
});

test('la solicitud es inmutable y el procesador comprueba perfil y caja de origen', { skip: red || disparador }, async () => {
  await sembrar(['s']);
  const a = cliente('a'), b = cliente('b'), v = venta('valida', ['s']);
  await assertFails(enviar(a, 'b', v));
  await assertFails(enviar(a, 'a', { ...v, rol: 'admin', uid: 'b' }));
  await enviar(a, 'a', v);
  await assertFails(enviar(a, 'a', v, 2));
  await assertFails(deleteDoc(rutaSolicitud(a, 'a', v.id)));
  await assertFails(getDocFromServer(rutaSolicitud(b, 'a', v.id)));
  await enviar(a, 'a', venta('ajena', ['s'], 'b'), 2);
  assert.equal(await procesar('a', 'ajena'), 'rechazada_conflicto');
  await assertFails(enviarActual(a, v, false));

  await updateDoc(doc(b, 'usuarios', 'a'), { activo: false });
  assert.equal(await procesar('a', v.id), 'rechazada_conflicto');
  assert.equal((await getDocFromServer(doc(b, 'ventas', v.id))).exists(), false);
  assert.equal((await getDocFromServer(doc(b, 'productos', 's'))).data().existencia, 1);
});

test('un cobro histórico con el mismo ID no vuelve a descontar existencias', { skip: red || disparador }, async () => {
  await sembrar(['s']);
  const a = cliente('a'), b = cliente('b');
  const v = venta('historica', ['s']);
  await enviarActual(a, v, false);
  await enviar(a, 'a', v);
  assert.equal(await procesar('a', v.id), 'confirmada_servidor');
  await enviar(b, 'b', venta(v.id, ['s'], 'b'));
  assert.equal(await procesar('b', v.id), 'rechazada_conflicto');
  assert.equal((await getDocFromServer(doc(b, 'ventas', v.id))).data().uid, 'a');
  assert.equal((await getDocsFromServer(collection(b, 'movimientos'))).size, 1);
  assert.equal((await getDocFromServer(doc(b, 'productos', 's'))).data().existencia, 0);
});

test('las líneas del mismo SKU comparten un único descuento y movimiento', { skip: red || disparador }, async () => {
  await sembrar(['s']);
  const a = cliente('a'), b = cliente('b'), v = venta('mismo-sku', ['s', 's']);
  await updateDoc(doc(b, 'productos', 's'), { existencia: 2 });
  await enviar(a, 'a', v);
  assert.equal(await procesar('a', v.id), 'confirmada_servidor');
  assert.equal((await getDocFromServer(doc(b, 'productos', 's'))).data().existencia, 0);
  const movimientos = await getDocsFromServer(collection(b, 'movimientos'));
  assert.equal(movimientos.size, 1);
  assert.equal(movimientos.docs[0].data().cantidad, -2);
});

test('el procesador acredita una autorización vinculada y conserva su identificador', { skip: red || disparador }, async () => {
  await sembrar(['s']);
  const a = cliente('a'), b = cliente('b');
  const v = venta('venta-aprobada', ['s']);
  const autorizacionId = 'autorizacion-procesador';
  const rebaja = 1000;
  v.descuento = { autorizacionId, autorizadoPor: 'b', tipo: 'monto', valor: rebaja, monto: rebaja };
  v.lineas[0] = { ...v.lineas[0], descuento: rebaja, comision: 2000, reducida: true };
  v.total -= rebaja;
  v.pagos[0] = { ...v.pagos[0], monto: v.total, equivalenteCop: v.total };
  const firmaCarrito = JSON.stringify([JSON.stringify([v.id, [['s', 1]]]), [['s', 1, 10000, false]]]);
  const autorizacion = doc(a, 'autorizaciones', autorizacionId);
  await setDoc(autorizacion, { uid: 'a', usuario: 'a', solicita: 'a', estado: 'pendiente', ventaId: v.id,
    firmaCarrito, subtotal: 10000, tipo: 'monto', valor: rebaja });
  await updateDoc(doc(b, 'autorizaciones', autorizacionId), { estado: 'aprobada', aprueba: 'b', respondida: fecha });
  await enviar(a, 'a', v);
  assert.equal(await procesar('a', v.id), 'confirmada_servidor');
  const queda = (await getDocFromServer(doc(b, 'ventas', v.id))).data();
  assert.equal(queda.descuento.autorizacionId, autorizacionId);
  assert.equal(queda.total, 9000);
});

test('la activación explícita conserva el cobro procesado y cierra la ruta de venta ordinaria anterior', { skip: red || disparador }, async () => {
  await sembrar(['s']);
  const a = cliente('a'), b = cliente('b');
  const estado = doc(b, 'sistema', 'estado');
  await entorno.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'sistema', 'estado'), { iniciado: true }));
  await assertFails(updateDoc(estado, { soloVentasProcesadas: true }));
  await entorno.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'sistema', 'estado'),
    { soloVentasProcesadas: true }));
  await assertFails(updateDoc(estado, { soloVentasProcesadas: false }));
  await assertFails(deleteDoc(estado));
  await updateDoc(estado, { iniciado: true });
  assert.equal((await getDocFromServer(estado)).data().soloVentasProcesadas, true);
  const v = venta('venta-luego-del-corte', ['s']);
  await assertFails(enviarActual(a, v));
  assert.equal((await getDocFromServer(doc(b, 'ventas', v.id))).exists(), false);
  assert.equal((await getDocFromServer(doc(b, 'productos', 's'))).data().existencia, 1);
  await enviar(a, 'a', v);
  assert.equal(await procesar('a', v.id), 'confirmada_servidor');
  assert.equal((await getDocFromServer(doc(b, 'productos', 's'))).data().existencia, 0);
});
