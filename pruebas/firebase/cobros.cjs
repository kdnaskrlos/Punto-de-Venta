// FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 NODE_PATH=/ruta/a/herramientas node --test pruebas/firebase/cobros.cjs
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:[1-9]\d{0,4}$/.test(host || '')) throw new Error('BLOQUEADO: requiere Firestore Emulator en 127.0.0.1');
const { assertFails, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { collection, doc, getDocsFromServer, getDocFromServer, increment, writeBatch, setDoc, updateDoc, deleteDoc, serverTimestamp, disableNetwork, enableNetwork, onSnapshot, query, where } = require('firebase/firestore');

const proyecto = 'demo-pos-bloque1';
const reglas = readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
const [direccion, puerto] = host.split(':');
const fecha = '2026-11-21T14:00:00.000Z';
let entorno;
before(async () => {
  entorno = await initializeTestEnvironment({ projectId: proyecto, firestore: { host: direccion, port: Number(puerto), rules: reglas } });
  console.log('Reglas cargadas SHA-256', createHash('sha256').update(reglas).digest('hex'));
});
after(async () => { await entorno?.cleanup(); });

async function preparar({ skus = [] } = {}) {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async contexto => {
    const db = contexto.firestore();
    const lote = writeBatch(db);
    for (const [usuario, rol] of [['a', 'vendedora'], ['b', 'admin'], ['g', 'encargada']]) {
      lote.set(doc(db, 'usuarios', usuario), { uid: usuario, usuario, activo: true, rol });
      lote.set(doc(db, 'cajas', usuario), { id: usuario, uid: usuario, usuario, estado: 'abierta' });
    }
    for (const sku of ['ultimo', ...skus]) lote.set(doc(db, 'productos', sku), { existencia: 1, precios: [11000, 11000, 11000, 11000, 11000] });
    lote.set(doc(db, 'apartados', 'ap'), { usuario: 'a', estado: 'pendiente', total: 22000, saldo: 22000, abonos: [] });
    await lote.commit();
  });
}

function docCobro(db, usuario, que, id) {
  return doc(db, 'usuarios', usuario, 'operacionesCobro', que + ':' + id);
}
function marca(que, id) {
  return { que, refId: id, fecha, orden: 1, dispositivo: 'sintetico', estadoSync: 'confirmada_servidor' };
}
function mover(lote, db, usuario, { id, sku, cantidad, motivo, ref = null }) {
  lote.update(doc(db, 'productos', sku), { existencia: increment(cantidad), ultimoMov: id });
  lote.set(doc(db, 'movimientos', id), { id, usuario, sku, cantidad, motivo, ref, fecha });
}
function vender(db, usuario, id, conMarca = true, skus = ['ultimo']) {
  const b = writeBatch(db);
  if (conMarca) b.set(docCobro(db, usuario, 'venta', id), marca('venta', id));
  for (const sku of skus) mover(b, db, usuario, { id: id + '-' + sku, sku, cantidad: -1, motivo: 'venta', ref: id });
  b.set(doc(db, 'ventas', id), { id, usuario, uid: usuario, cajaId: usuario, estado: 'ok', numero: null, fecha, pagos: [{ monto: 22000, forma: 'efectivo-cop' }] });
  return b.commit();
}
function esperarLocal(ref) {
  return new Promise((resolve, reject) => {
    const parar = onSnapshot(ref, { includeMetadataChanges: true }, s => {
      if (s.exists() && s.metadata.hasPendingWrites) { parar(); resolve(s.data()); }
    }, reject);
  });
}

test('dos clientes offline cobran el último SKU; el segundo lote se rechaza también para administrador', { timeout: 30000 }, async () => {
  await preparar();
  const a = entorno.authenticatedContext('a').firestore();
  const b = entorno.authenticatedContext('b').firestore();
  const producto = doc(a, 'productos', 'ultimo');
  await Promise.all([getDocFromServer(producto), getDocFromServer(doc(b, 'productos', 'ultimo'))]);
  await Promise.all([disableNetwork(a), disableNetwork(b)]);
  const localA = esperarLocal(doc(a, 'ventas', 'va')), localB = esperarLocal(doc(b, 'ventas', 'vb'));
  const confirmarA = vender(a, 'a', 'va'), resultadoB = assertFails(vender(b, 'b', 'vb'));
  assert.equal((await localA).pagos[0].monto, 22000);
  assert.equal((await localB).pagos[0].monto, 22000);
  await enableNetwork(a);
  await confirmarA;
  await enableNetwork(b);
  await resultadoB;
  assert.equal((await getDocFromServer(producto)).data().existencia, 0);
  assert.equal((await getDocFromServer(doc(a, 'ventas', 'va'))).data().cajaId, 'a');
  assert.equal((await getDocFromServer(doc(b, 'ventas', 'vb'))).exists(), false);
  assert.equal((await getDocFromServer(docCobro(b, 'b', 'venta', 'vb'))).exists(), false);
});

test('las reglas protegen también el lote anterior sin marca y rechazan duplicar un abono marcado', { timeout: 30000 }, async () => {
  await preparar();
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
  await vender(a, 'a', 'v1', false);
  await assertFails(vender(b, 'b', 'v2', false));
  const abonar = async () => {
    const lote = writeBatch(a);
    lote.set(docCobro(a, 'a', 'abono', 'p1'), { ...marca('abono', 'p1'), apartadoId: 'ap' });
    lote.update(doc(a, 'apartados', 'ap'), { abonos: [{ id: 'p1', equivalenteCop: 5000 }], saldo: increment(-5000), ultimoAbono: 'abono:p1' });
    await lote.commit();
  };
  await abonar();
  await assertFails(abonar());
  assert.equal((await getDocFromServer(doc(a, 'apartados', 'ap'))).data().saldo, 17000);
  await assertFails(setDoc(docCobro(a, 'b', 'abono', 'otro'), marca('abono', 'otro')));
});

test('vendedora y encargada no pueden ajustar existencias y el lote se revierte completo', { timeout: 30000 }, async () => {
  await preparar();
  const vendedora = entorno.authenticatedContext('a').firestore();
  const encargada = entorno.authenticatedContext('g').firestore();
  const admin = entorno.authenticatedContext('b').firestore();
  for (const [usuario, db] of [['a', vendedora], ['g', encargada]]) {
    const lote = writeBatch(db), id = 'ajuste-' + usuario;
    mover(lote, db, usuario, { id, sku: 'ultimo', cantidad: -2, motivo: 'ajuste' });
    await assertFails(lote.commit());
    assert.equal((await getDocFromServer(doc(db, 'productos', 'ultimo'))).data().existencia, 1);
    assert.equal((await getDocFromServer(doc(admin, 'movimientos', id))).exists(), false);
  }
});

test('rechaza tipos y motivos inválidos y comprueba permisos en el movimiento y en el producto', { timeout: 30000 }, async () => {
  await preparar();
  const vendedora = entorno.authenticatedContext('a').firestore();
  const admin = entorno.authenticatedContext('b').firestore();
  const movimiento = { usuario: 'a', sku: 'ultimo', cantidad: -1, motivo: 'venta', ref: 'sin-venta', fecha };
  for (const datos of [{ cantidad: -0.5 }, { motivo: 'desconocido' }, { motivo: 'venta', cantidad: 1 },
    { motivo: 'cancelación', cantidad: 1 }, { motivo: 'importación', ref: null }, { motivo: 'sincronización', ref: null },
    { motivo: 'ajuste', ref: null }, { ref: '' }]) {
    await assertFails(setDoc(doc(vendedora, 'movimientos', 'invalido'), { ...movimiento, ...datos }));
  }
  await entorno.withSecurityRulesDisabled(contexto => setDoc(doc(contexto.firestore(), 'movimientos', 'historico'), { ...movimiento, motivo: 'ajuste', cantidad: -2, ref: null }));
  await assertFails(setDoc(doc(vendedora, 'productos', 'ultimo'), { existencia: -1, ultimoMov: 'historico' }, { merge: true }));
  await assertFails(setDoc(doc(admin, 'movimientos', 'sin-venta'), { ...movimiento, usuario: 'b' }));
  assert.equal((await getDocFromServer(doc(vendedora, 'productos', 'ultimo'))).data().existencia, 1);
});

test('venta, reserva, anulación, cancelación y ajuste de administración autorizados', { timeout: 30000 }, async () => {
  await preparar({ skus: ['aparte'] });
  const vendedora = entorno.authenticatedContext('a').firestore();
  const encargada = entorno.authenticatedContext('g').firestore();
  const admin = entorno.authenticatedContext('b').firestore();
  await vender(vendedora, 'a', 'venta-legal');
  const reserva = writeBatch(vendedora);
  mover(reserva, vendedora, 'a', { id: 'reservar', sku: 'aparte', cantidad: -1, motivo: 'apartado', ref: 'ap-legal' });
  reserva.set(doc(vendedora, 'apartados', 'ap-legal'), { id: 'ap-legal', usuario: 'a', uid: 'a', estado: 'pendiente', total: 20000, saldo: 20000, abonos: [] });
  await reserva.commit();
  const anular = (db, usuario, id) => {
    const b = writeBatch(db);
    mover(b, db, usuario, { id, sku: 'ultimo', cantidad: 1, motivo: 'anulación', ref: 'venta-legal' });
    b.update(doc(db, 'ventas', 'venta-legal'), { estado: 'anulada', anulacion: { por: usuario, motivo: 'devolución', fecha } });
    return b.commit();
  };
  await assertFails(anular(vendedora, 'a', 'anular-vendedora'));
  await anular(encargada, 'g', 'anular-gestion');
  await assertFails(anular(encargada, 'g', 'anular-otra-vez'));
  const cancelar = writeBatch(encargada);
  mover(cancelar, encargada, 'g', { id: 'cancelar', sku: 'aparte', cantidad: 1, motivo: 'cancelación', ref: 'ap-legal' });
  cancelar.update(doc(encargada, 'apartados', 'ap-legal'), { estado: 'cancelado', cancelacion: { por: 'g', motivo: 'solicitud', fecha } });
  await cancelar.commit();
  assert.equal((await getDocFromServer(doc(admin, 'productos', 'ultimo'))).data().existencia, 1);
  assert.equal((await getDocFromServer(doc(admin, 'productos', 'aparte'))).data().existencia, 1);
  const ajuste = writeBatch(admin);
  mover(ajuste, admin, 'b', { id: 'ajuste-admin', sku: 'ultimo', cantidad: -2, motivo: 'ajuste' });
  await assertFails(ajuste.commit());
  const valido = writeBatch(admin);
  mover(valido, admin, 'b', { id: 'ajuste-admin-valido', sku: 'ultimo', cantidad: -1, motivo: 'ajuste' });
  await valido.commit();
  assert.equal((await getDocFromServer(doc(admin, 'productos', 'ultimo'))).data().existencia, 0);
});

test('una cesta de 24 SKU es atómica en el emulador incluso si falla el último SKU', { timeout: 30000 }, async () => {
  const skus = Array.from({ length: 24 }, (_, i) => 'cesta-' + i);
  await preparar({ skus });
  const db = entorno.authenticatedContext('a').firestore();
  const existencias = async () => {
    const respuesta = await getDocsFromServer(collection(db, 'productos'));
    return new Map(respuesta.docs.map(p => [p.id, p.data().existencia]));
  };
  const ultimo = skus.at(-1);
  await entorno.withSecurityRulesDisabled(contexto => setDoc(doc(contexto.firestore(), 'productos', ultimo), { existencia: 0 }));
  await assertFails(vender(db, 'a', 'cesta-rechazada', true, skus));
  const trasRechazo = await existencias();
  assert.deepEqual(skus.map(sku => trasRechazo.get(sku)), [...skus.slice(0, -1).map(() => 1), 0]);
  assert.equal((await getDocFromServer(doc(db, 'ventas', 'cesta-rechazada'))).exists(), false);
  assert.equal((await getDocFromServer(docCobro(db, 'a', 'venta', 'cesta-rechazada'))).exists(), false);

  await entorno.withSecurityRulesDisabled(contexto => setDoc(doc(contexto.firestore(), 'productos', ultimo), { existencia: 1 }));
  await vender(db, 'a', 'cesta-confirmada', true, skus);
  const trasConfirmar = await existencias();
  assert.ok(skus.every(sku => trasConfirmar.get(sku) === 0));
  assert.equal((await getDocFromServer(doc(db, 'ventas', 'cesta-confirmada'))).exists(), true);
  assert.equal((await getDocFromServer(docCobro(db, 'a', 'venta', 'cesta-confirmada'))).data().estadoSync, 'confirmada_servidor');
});


test('cestas grandes de 32, 48 y 64 SKU: se confirman totalmente o se rechazan sin escrituras parciales', { timeout: 120000 }, async () => {
  for (const cantidad of [32, 48, 64]) {
    const skus = Array.from({ length: cantidad }, (_, i) => 'prueba-grande-' + i);
    await preparar({ skus });
    const db = entorno.authenticatedContext('a').firestore();
    const id = 'cesta-grande-' + cantidad;
    let aceptada = false;
    try {
      await vender(db, 'a', id, true, skus);
      aceptada = true;
    } catch (error) {
      assert.ok(error?.code === 'permission-denied' || error?.code === 'resource-exhausted',
        'Rechazo inesperado: ' + String(error?.code || error));
    }
    const snap = await getDocsFromServer(collection(db, 'productos'));
    const stock = new Map(snap.docs.map(p => [p.id, p.data().existencia]));
    assert.ok(skus.every(sku => stock.get(sku) === (aceptada ? 0 : 1)),
      'No se permiten descuentos parciales para cesta de ' + cantidad + ' SKU');
    assert.equal((await getDocFromServer(doc(db, 'ventas', id))).exists(), aceptada);
    assert.equal((await getDocFromServer(docCobro(db, 'a', 'venta', id))).exists(), aceptada);
    console.log('Cesta de ' + cantidad + ' SKU en emulador: ' + (aceptada ? 'confirmada' : 'rechazada atómicamente'));
  }
});

async function adaptadorReal(dbPorUsuario, escuchas) {
  const { registerHooks } = require('node:module');
  const { pathToFileURL } = require('node:url');
  const archivo = path.resolve(__dirname, '../../js/datos/firebase.js');
  const fuente = readFileSync(archivo, 'utf8');
  const urls = new Map();
  for (const [, nombres, url] of fuente.matchAll(/import \{ ([^}]+) \} from '(https:\/\/www\.gstatic\.com\/firebasejs\/[^']+)'/g)) {
    const codigo = nombres.split(', ').map(n => `export const ${n} = (...a) => globalThis.posSdkEmulado.${n}(...a);`).join('\n');
    urls.set(url, 'data:text/javascript,' + encodeURIComponent(codigo));
  }
  const hooks = registerHooks({
    resolve(specifier, contexto, siguiente) {
      if (urls.has(specifier)) return { url: urls.get(specifier), shortCircuit: true };
      return siguiente(specifier, contexto);
    },
  });
  globalThis.posSdkEmulado = {
    ...require('firebase/firestore'),
    initializeApp: config => config,
    initializeFirestore: config => dbPorUsuario[config.uid],
    getAuth: config => config,
    onAuthStateChanged: (auth, cb) => queueMicrotask(() => cb({ uid: auth.uid })),
    onSnapshot(...args) {
      const quitar = onSnapshot(...args);
      escuchas.add(quitar);
      return () => { escuchas.delete(quitar); quitar(); };
    },
  };
  try { return await import(pathToFileURL(archivo).href); }
  finally { hooks.deregister(); }
}

async function prepararAdaptadores(t, a, b, opciones) {
  const datos = new Map();
  const globals = {
    addEventListener() {},
    navigator: { onLine: true, userAgent: 'Emulador' },
    localStorage: {
      setItem: (k, v) => datos.set(k, v), getItem: k => datos.get(k) ?? null,
      removeItem: k => datos.delete(k), key: i => [...datos.keys()][i], get length() { return datos.size; },
    },
  };
  for (const [clave, value] of Object.entries(globals)) {
    const previo = Object.getOwnPropertyDescriptor(globalThis, clave);
    Object.defineProperty(globalThis, clave, { configurable: true, value });
    t.after(() => previo ? Object.defineProperty(globalThis, clave, previo) : delete globalThis[clave]);
  }
  const escuchas = new Set();
  t.after(() => {
    for (const quitar of escuchas) quitar();
    delete globalThis.posSdkEmulado;
  });
  const { crearFirebase } = await adaptadorReal({ a, b }, escuchas);
  const { leerPendientes, revisarPendientes } = await import('../../js/datos/pendientes.js');
  const abrir = (uid, ajustes = opciones) => crearFirebase({ uid, projectId: proyecto }, ajustes);
  const posA = abrir('a'), posB = b && abrir('b');
  const esperarSesion = pos => new Promise(r => pos.alCambiarSesion(s => { if (s) r(s); }));
  const [sesionA, sesionB] = await Promise.all([posA, posB].filter(Boolean).map(esperarSesion));
  return { posA, posB, sesionA, sesionB, leerPendientes, revisarPendientes, abrir, esperarSesion };
}

test('el adaptador del POS conserva caja, pagos y fecha del segundo cobro y registra su conflicto', { timeout: 45000 }, async t => {
  await preparar();
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
  const { posA, posB, sesionB, leerPendientes, revisarPendientes } = await prepararAdaptadores(t, a, b);
  const producto = doc(a, 'productos', 'ultimo');
  await Promise.all([getDocFromServer(producto), getDocFromServer(doc(b, 'productos', 'ultimo'))]);
  await Promise.all([disableNetwork(a), disableNetwork(b)]);

  const venta = { fecha, lineas: [{ sku: 'ultimo', cantidad: 1 }], total: 22000, pagos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 22000 }] };
  const [primera, segunda] = await Promise.all([posA.guardarVenta({ ...venta, id: 'pos-a' }), posB.guardarVenta({ ...venta, id: 'pos-b' })]);
  assert.deepEqual([primera.estadoSync, segunda.estadoSync], ['local_pendiente', 'local_pendiente'], JSON.stringify([primera, segunda]));
  assert.equal(leerPendientes('b')[0].datos.cajaId, 'b');

  await enableNetwork(a);
  assert.equal(await posA.esperarSubidas(), true);
  assert.equal(await posA.verificarCobro({ que: 'venta', id: 'pos-a' }), 'confirmada_servidor');
  await enableNetwork(b);
  await revisarPendientes({ sesion: sesionB, almacen: posB });
  assert.equal(await posB.verificarCobro({ que: 'venta', id: 'pos-b' }), 'rechazada_conflicto');
  const conflicto = await posB.verificarServidor('conflictos', 'rechazada-venta-pos-b');
  assert.deepEqual(conflicto.datos.pagos, venta.pagos);
  assert.equal(conflicto.datos.cajaId, 'b');
  assert.equal(conflicto.fecha, fecha);
  assert.equal((await getDocFromServer(producto)).data().existencia, 0);
  assert.equal(await posB.verificarServidor('ventas', 'pos-b'), null);
});


test('reserva, abono y liquidación offline se sincronizan en orden sin descontar stock dos veces', { timeout: 45000 }, async t => {
  await preparar();
  const a = entorno.authenticatedContext('a').firestore();
  const { posA, leerPendientes } = await prepararAdaptadores(t, a);
  const producto = doc(a, 'productos', 'ultimo');
  await getDocFromServer(producto);
  await disableNetwork(a);

  const base = { fecha, cliente: { nombre: 'Cliente QA' }, lineas: [{ sku: 'ultimo', cantidad: 1 }], total: 22000 };
  const efectivo = monto => ({ forma: 'efectivo-cop', moneda: 'COP', monto, equivalenteCop: monto });
  const reserva = { ...base, id: 'reserva-offline', abonos: [] };
  const pago = { ...efectivo(5000), id: 'abono-offline', fecha };
  const venta = { ...base, id: 'liquidacion-offline', abonosPrevios: 5000, pagos: [efectivo(17000)] };
  for (const operar of [
    () => posA.guardarApartado(reserva),
    () => posA.abonarApartado(reserva.id, pago),
    () => posA.abonarApartado(reserva.id, pago),
    () => posA.completarApartado(reserva.id, venta),
  ]) assert.equal((await operar()).estadoSync, 'local_pendiente');
  assert.deepEqual(leerPendientes('a').map(p => p.id), [reserva.id, pago.id, venta.id]);

  await enableNetwork(a);
  assert.equal(await posA.esperarSubidas(), true);
  for (const [que, id] of [['apartado', reserva.id], ['abono', pago.id], ['completar', venta.id]]) {
    assert.equal(await posA.verificarCobro({ que, id }), 'confirmada_servidor');
  }
  const ap = (await getDocFromServer(doc(a, 'apartados', reserva.id))).data();
  const final = (await getDocFromServer(doc(a, 'ventas', venta.id))).data();
  assert.deepEqual(ap.abonos.map(x => [x.id, x.monto, x.cajaId]), [[pago.id, 5000, 'a']]);
  assert.deepEqual([ap.estado, ap.saldo, ap.ventaId], ['completado', 0, venta.id]);
  assert.deepEqual([final.cajaId, final.desdeApartado, final.pagos[0].monto, final.fecha], ['a', reserva.id, 17000, fecha]);
  assert.equal((await getDocFromServer(producto)).data().existencia, 0);
  assert.deepEqual(leerPendientes('a'), []);
});

test('dos sesiones que liquidan la misma reserva offline conservan un solo cobro y un conflicto conciliable', { timeout: 45000 }, async t => {
  await preparar();
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
  const { posA, posB, sesionB, revisarPendientes } = await prepararAdaptadores(t, a, b);
  const reserva = { id: 'misma-reserva', fecha, cliente: { nombre: 'Cliente QA' },
    lineas: [{ sku: 'ultimo', cantidad: 1 }], total: 22000, abonos: [] };
  assert.equal((await posA.guardarApartado(reserva)).estadoSync, 'confirmada_servidor');
  // Las dos pantallas mantienen la reserva en escucha antes de desconectarse.
  await Promise.all([a, b].map(db => new Promise((resolve, reject) => {
    const quitar = onSnapshot(doc(db, 'apartados', reserva.id), { includeMetadataChanges: true }, s => {
      if (s.exists() && !s.metadata.fromCache && !s.metadata.hasPendingWrites) resolve();
    }, reject);
    t.after(quitar);
  })));
  await Promise.all([disableNetwork(a), disableNetwork(b)]);
  const base = { ...reserva, abonosPrevios: 0, pagos: [{ forma: 'efectivo-cop', monto: 22000 }] };
  const [primera, segunda] = await Promise.all([
    posA.completarApartado(reserva.id, { ...base, id: 'liquidacion-a' }),
    posB.completarApartado(reserva.id, { ...base, id: 'liquidacion-b' }),
  ]);
  assert.deepEqual([primera.estadoSync, segunda.estadoSync], ['local_pendiente', 'local_pendiente'], JSON.stringify([primera, segunda]));

  await enableNetwork(a);
  assert.equal(await posA.esperarSubidas(), true);
  await enableNetwork(b);
  await revisarPendientes({ sesion: sesionB, almacen: posB });
  const conflicto = await posB.verificarServidor('conflictos', 'rechazada-completar-liquidacion-b');
  assert.deepEqual([conflicto.apartadoId, conflicto.datos.cajaId, conflicto.datos.pagos[0].monto], [reserva.id, 'b', 22000]);
  assert.equal(await posB.verificarServidor('ventas', 'liquidacion-b'), null);
  assert.equal((await posB.verificarServidor('apartados', reserva.id)).ventaId, 'liquidacion-a');
  assert.equal((await posB.verificarServidor('productos', 'ultimo')).existencia, 0);
});

test('el POS aplica cestas grandes del adaptador completo y el reintento conserva el mismo cobro', { timeout: 90000 }, async t => {
  const cantidades = [24, 32, 48, 64];
  const skus = cantidades.flatMap(n => Array.from({ length: n }, (_, i) => 'pos-' + n + '-' + i));
  await preparar({ skus });
  const a = entorno.authenticatedContext('a').firestore();
  const b = entorno.authenticatedContext('b').firestore();
  const { posA } = await prepararAdaptadores(t, a);
  for (const n of cantidades) {
    const lineas = skus.filter(sku => sku.startsWith('pos-' + n + '-')).map(sku => ({ sku, cantidad: 1 }));
    const total = 10000 * n;
    const venta = { id: 'pos-cesta-' + n, fecha, lineas, total, pagos: [{ forma: 'efectivo-cop', monto: total }] };
    for (let intento = 0; intento < 2; intento++) {
      const resultado = await posA.guardarVenta(venta);
      assert.ok(resultado.ok, JSON.stringify(resultado));
      assert.equal(await posA.esperarSubidas(), true);
      assert.equal(await posA.verificarCobro({ que: 'venta', id: venta.id }), 'confirmada_servidor');
    }
    const guardada = (await getDocFromServer(doc(a, 'ventas', venta.id))).data();
    assert.deepEqual([guardada.cajaId, guardada.fecha, guardada.pagos[0].monto, guardada.lineas.length], ['a', fecha, total, n]);
  }
  const productos = await getDocsFromServer(collection(a, 'productos'));
  const stock = new Map(productos.docs.map(d => [d.id, d.data().existencia]));
  assert.ok(skus.every(sku => stock.get(sku) === 0));
  const movimientos = await getDocsFromServer(collection(b, 'movimientos'));
  assert.equal(movimientos.size, skus.length);
  assert.deepEqual(new Set(movimientos.docs.map(d => d.data().sku)), new Set(skus));
});

test('la actividad crítica exige autoría real y una transición atómica del documento referenciado', async t => {
  await preparar();
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
  const registro = (id, tipo, col, refId, rol = 'vendedora') => ({
    id, tipo, ref: { col, id: refId }, en: serverTimestamp(), uid: 'a', usuario: 'a', rol,
  });
  await t.test('rechaza ventas y aprobaciones inventadas por una vendedora', async () => {
    await assertFails(setDoc(doc(a, 'eventos', 'inventada'), registro('inventada', 'venta.creada', 'ventas', 'ausente')));
    await assertFails(setDoc(doc(a, 'eventos', 'aprobada'), registro('aprobada', 'descuento.aprobado', 'autorizaciones', 'ausente', 'admin')));
  });
  await t.test('admite formato anterior para una venta real, sin suplantación ni repetición', async () => {
    const venta = { id: 'real', usuario: 'a', uid: 'a', cajaId: 'a', estado: 'ok', fecha };
    const conVenta = (id, rol) => {
      const lote = writeBatch(a);
      lote.set(doc(a, 'ventas', venta.id), venta);
      lote.set(doc(a, 'eventos', id), registro(id, 'venta.creada', 'ventas', venta.id, rol));
      return lote.commit();
    };
    await assertFails(conVenta('suplantada', 'admin'));
    await conVenta('real', 'vendedora');
    await assertFails(setDoc(doc(a, 'eventos', 'repetida'), registro('repetida', 'venta.creada', 'ventas', venta.id)));
    await assertFails(getDocFromServer(doc(a, 'eventos', 'real')));
    assert.equal((await getDocFromServer(doc(b, 'eventos', 'real'))).data().rol, 'vendedora');
    await assertFails(updateDoc(doc(b, 'eventos', 'real'), { rol: 'admin' }));
    await assertFails(deleteDoc(doc(b, 'eventos', 'real')));
  });
});

test('solo el admin puede aprobar con su propia identidad y un estado resolutivo', async () => {
  await preparar();
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
  const solicitud = { uid: 'a', usuario: 'a', solicita: 'a', estado: 'pendiente' };
  await assertFails(setDoc(doc(a, 'autorizaciones', 'ajena'), { ...solicitud, uid: 'b', solicita: 'b' }));
  await setDoc(doc(a, 'autorizaciones', 'aut'), solicitud);
  await assertFails(updateDoc(doc(b, 'autorizaciones', 'aut'), { estado: 'aprobada', aprueba: 'a', respondida: fecha }));
  await assertFails(updateDoc(doc(b, 'autorizaciones', 'aut'), { estado: 'inventado', aprueba: 'b', respondida: fecha }));
  await assertFails(updateDoc(doc(a, 'autorizaciones', 'aut'), { estado: 'aprobada', aprueba: 'a', respondida: fecha }));
  await updateDoc(doc(b, 'autorizaciones', 'aut'), { estado: 'aprobada', aprueba: 'b', respondida: fecha });
  assert.equal((await getDocFromServer(doc(a, 'autorizaciones', 'aut'))).data().aprueba, 'b');
});

test('la importación conserva el lote aplicado y reanuda sin sobrescribir existencias cambiadas', { timeout: 45000 }, async t => {
  await preparar({ skus: ['z'] });
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
  const { posB } = await prepararAdaptadores(t, a, b);
  const plan = {
    nuevos: ['i1', 'i2'].map(sku => ({ sku, existencia: 2, costo: 1000 })),
    cambios: [],
    existencias: [{ sku: 'z', antes: 2, despues: 5 }],
  };
  const fallo = await posB.aplicarImportacion(plan, { existencias: true });
  assert.equal(fallo.ok, false);
  assert.equal(fallo.error, 'conflicto');
  assert.equal(fallo.lotesAplicados, 1);
  const id = fallo.importacionId;
  assert.equal(typeof id, 'string');
  const cabecera = doc(b, 'importaciones', id);
  const lote = doc(b, 'importaciones', id, 'lotes', '0');
  const detalle = doc(b, 'importaciones', id, 'lotes', '0', 'detalles', 'i1');
  assert.equal((await getDocFromServer(cabecera)).data().siguiente, 1);
  assert.equal((await getDocFromServer(lote)).data().uid, 'b');
  assert.equal((await getDocFromServer(detalle)).data().existenciaAntes, null);
  const aplicado = (await getDocFromServer(detalle)).data();
  assert.equal(aplicado.existenciaDespues, 2);
  const mov = (await getDocFromServer(doc(b, 'movimientos', aplicado.movimientoId))).data();
  assert.equal(mov.importacionId, id);
  assert.equal(mov.loteImportacion, '0');
  assert.equal(mov.cantidad, 2);
  await assertFails(setDoc(doc(b, 'movimientos', 'importacion-falsa'), { ...mov, id: 'importacion-falsa' }));
  assert.equal((await getDocFromServer(doc(b, 'productos', 'z'))).data().existencia, 1);
  await assertFails(updateDoc(detalle, { existenciaDespues: 99 }));
  await assertFails(deleteDoc(lote));
  await assertFails(getDocFromServer(doc(a, 'importaciones', id)));

  await updateDoc(doc(b, 'productos', 'z'), { existencia: 2 });
  await updateDoc(doc(b, 'productos', 'i1'), { existencia: 1 });
  const recuperada = await posB.aplicarImportacion(plan, { existencias: true });
  assert.equal(recuperada.ok, true);
  assert.equal(recuperada.importacionId, id);
  assert.equal((await getDocFromServer(cabecera)).data().siguiente, 2);
  assert.equal((await getDocFromServer(doc(b, 'productos', 'i1'))).data().existencia, 1);
  assert.equal((await getDocFromServer(doc(b, 'productos', 'z'))).data().existencia, 5);
});

test('caja, descuentos, ajustes y cliente generan sus eventos desde el adaptador', { timeout: 45000 }, async t => {
  await preparar();
  await entorno.withSecurityRulesDisabled(contexto => deleteDoc(doc(contexto.firestore(), 'cajas', 'a')));
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
  const { posA, posB } = await prepararAdaptadores(t, a, b);
  const caja = await posA.abrirCaja({ COP: 10000 });
  assert.equal(caja.ok, true);
  assert.equal((await posA.movimientoCaja(caja.id, { tipo: 'salida', forma: 'efectivo-cop', monto: 1000, moneda: 'COP' })).ok, true);
  assert.equal((await posA.cerrarCaja(caja.id, { totalCop: 0 })).ok, true);

  const solicitud = await posA.solicitarAutorizacion({ tipo: 'monto', valor: 1000, subtotal: 22000 });
  assert.equal(solicitud.ok, true);
  assert.equal((await posB.responderAutorizacion(solicitud.id, true)).ok, true);
  assert.equal((await posB.ajustarExistencia('ultimo', 1, 'conteo sintético')).ok, true);
  assert.equal((await posB.guardarAjustes('tasas', { copPorUsd: 4100 })).ok, true);
  assert.equal((await posA.guardarCliente({ telefono: '+573001234567', nombre: 'Persona sintética' })).ok, true);
  assert.equal(await posA.esperarSubidas(), true);
  assert.equal(await posB.esperarSubidas(), true);

  const eventos = new Map((await getDocsFromServer(collection(b, 'eventos'))).docs.map(s => [s.data().tipo, s.data()]));
  for (const [tipo, uid] of [
    ['caja.abierta', 'a'], ['caja.salida', 'a'], ['caja.cerrada', 'a'], ['descuento.pedido', 'a'],
    ['descuento.aprobado', 'b'], ['inventario.ajuste', 'b'], ['ajustes.cambiados', 'b'], ['cliente.guardado', 'a'],
  ]) {
    assert.equal(eventos.get(tipo)?.uid, uid, tipo);
    assert.ok(eventos.get(tipo).en.toMillis() > 0, tipo);
  }
  assert.doesNotMatch(eventos.get('cliente.guardado').resumen, /Persona sintética/);
});

test('guardarVenta conserva 64 SKU sin red y vacía su cola ordenada al reabrir, incluso con la opción desactivada', { timeout: 45000 }, async t => {
  const skus = Array.from({ length: 64 }, (_, i) => 'servidor-' + i);
  await preparar({ skus });
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
  const { posA, leerPendientes, revisarPendientes, abrir, esperarSesion } = await prepararAdaptadores(t, a, b, { ventasAtomicas: true });
  const disparador = process.env.POS_CESTAS_DISPARADOR_LOCAL === '1';
  const prepararVenta = (id, codigos) => ({
    id, fecha, subtotal: 11000 * codigos.length, total: 11000 * codigos.length, cliente: { nombre: 'Cliente sintético' },
    pagos: [{ forma: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP', monto: 11000 * codigos.length, equivalenteCop: 11000 * codigos.length }],
    lineas: codigos.map(sku => ({ sku, cantidad: 1, tramo: codigos.length >= 48 ? 4 : 0,
      precioUnit: 11000, subtotal: 11000, descuento: 0, oferta: false, comision: codigos.length >= 48 ? 1000 : 4000, reducida: false })),
  });
  const v1 = prepararVenta('cola-grande', skus), v2 = prepararVenta('cola-siguiente', ['ultimo']);
  const solicitud = id => doc(a, 'usuarios', 'a', 'solicitudesVenta', id);
  const cajas = query(collection(a, 'cajas'), where('usuario', '==', 'a'), where('estado', '==', 'abierta'));
  assert.equal((await getDocsFromServer(cajas)).size, 1);
  await disableNetwork(a);
  navigator.onLine = false;
  const fueraDePresupuesto = prepararVenta('cesta-fuera-de-presupuesto', Array.from({ length: 249 }, (_, i) => 's' + i));
  assert.deepEqual(await posA.guardarVenta(fueraDePresupuesto), { ok: false, error: 'limite-venta' });
  assert.deepEqual(leerPendientes('a'), []);
  assert.equal((await posA.guardarVenta(v1)).estadoSync, 'local_pendiente');
  assert.equal((await posA.guardarVenta(v1)).estadoSync, 'local_pendiente');
  assert.equal((await posA.guardarVenta(v2)).estadoSync, 'local_pendiente');
  const pendientes = leerPendientes('a');
  assert.deepEqual(pendientes.map(p => [p.id, p.orden, p.datos.cajaId, p.datos.offline]), [
    [v1.id, 1, 'a', true], [v2.id, 2, 'a', true],
  ]);
  assert.equal(localStorage.getItem('pos-cobro-a:venta:' + v1.id), null);
  assert.equal((await getDocFromServer(doc(b, 'ventas', v1.id))).exists(), false);

  // Otra sesión cerró la caja; la recuperación conserva la caja y los pagos de origen.
  await entorno.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'cajas', 'a'), { estado: 'cerrada' }));
  const reabierto = abrir('a', { ventasAtomicas: false }), sesion = await esperarSesion(reabierto);
  assert.equal(await reabierto.estadoCobro('venta', v1.id), 'local_pendiente');
  await enableNetwork(a);
  navigator.onLine = true;
  const ctx = { sesion, almacen: reabierto };
  if (disparador) {
    const tope = Date.now() + 15000;
    while (leerPendientes('a').length && Date.now() < tope) await revisarPendientes(ctx);
  } else {
    const { procesar, cerrar } = require('./servicio-ventas.cjs');
    t.after(cerrar);
    await revisarPendientes(ctx); // Primer intento con el procesador aún sin respuesta.
    assert.equal((await getDocFromServer(solicitud(v1.id))).exists(), true);
    assert.equal((await getDocFromServer(solicitud(v2.id))).exists(), false);
    assert.equal((await getDocsFromServer(collection(b, 'conflictos'))).size, 0);
    assert.equal(leerPendientes('a').length, 2);
    assert.equal(await procesar('a', v1.id), 'confirmada_servidor');
    const confirmarSegunda = new Promise((resolve, reject) => {
      const quitar = onSnapshot(solicitud(v2.id), s => {
        if (s.exists() && !s.metadata.hasPendingWrites) { quitar(); procesar('a', v2.id).then(resolve, reject); }
      }, reject);
      t.after(quitar);
    });
    await Promise.all([revisarPendientes(ctx), confirmarSegunda]);
  }
  await revisarPendientes(ctx);
  assert.deepEqual(leerPendientes('a'), []);
  assert.equal(await reabierto.estadoCobro('venta', v1.id), 'confirmada_servidor');
  const leerVenta = v => getDocFromServer(doc(b, 'ventas', v.id)).then(s => s.data());
  let [grande, siguiente] = await Promise.all([v1, v2].map(leerVenta));
  if (disparador) {
    const tope = Date.now() + 5000;
    while ((!grande?.numero || !siguiente?.numero) && Date.now() < tope) {
      await new Promise(r => setTimeout(r, 100));
      [grande, siguiente] = await Promise.all([v1, v2].map(leerVenta));
    }
  }
  assert.deepEqual([grande.cajaId, grande.fecha, grande.pagos, grande.lineas.length, grande.numero],
    ['a', fecha, v1.pagos, 64, 'V-0001']);
  assert.equal(siguiente.numero, 'V-0002');
  assert.equal((await getDocsFromServer(collection(b, 'movimientos'))).size, 65);
});

test('anular una venta de apartado devuelve abono y saldo por sus formas originales', { timeout: 30000 }, async t => {
  await preparar();
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
  const { posA, posB } = await prepararAdaptadores(t, a, b);
  const id = 'anular-apartado-pos';
  const v = { id: 'venta-de-apartado-pos', fecha, lineas: [{ sku: 'ultimo', cantidad: 1 }], total: 22000 };
  assert.equal((await posA.guardarApartado({ ...v, id, abonos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 10000, equivalenteCop: 10000 }] })).ok, true);
  assert.equal(await posA.esperarSubidas(), true);
  assert.equal((await posA.completarApartado(id, { ...v, abonosPrevios: 10000,
    pagos: [{ forma: 'transferencia-cop', moneda: 'COP', monto: 12000 }] })).ok, true);
  assert.equal(await posA.esperarSubidas(), true);
  assert.equal((await posB.anularVenta(v.id, 'Anulación total de control')).ok, true);
  assert.equal(await posB.esperarSubidas(), true);
  const caja = (await getDocFromServer(doc(b, 'cajas', 'a'))).data();
  assert.deepEqual(caja.movimientos.map(m => [m.tipo, m.forma, m.monto]), [
    ['salida', 'efectivo-cop', 10000], ['salida', 'transferencia-cop', 12000],
  ]);
  assert.equal((await getDocFromServer(doc(b, 'productos', 'ultimo'))).data().existencia, 1);
});

test('dos ajustes administrativos concurrentes preservan la última unidad sin saldo negativo', { timeout: 30000 }, async t => {
  await preparar();
  await entorno.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'usuarios', 'a'), { rol: 'admin' }));
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
  const { posA, posB } = await prepararAdaptadores(t, a, b);
  assert.deepEqual((await Promise.all([posA.obtener('productos', 'ultimo'), posB.obtener('productos', 'ultimo')])).map(p => p.existencia), [1, 1]);
  await Promise.all([posA.ajustarExistencia('ultimo', -1, 'Conteo', 'A'), posB.ajustarExistencia('ultimo', -1, 'Conteo', 'B')]);
  await Promise.all([posA.esperarSubidas(), posB.esperarSubidas()]);
  assert.equal((await getDocFromServer(doc(b, 'productos', 'ultimo'))).data().existencia, 0);
  assert.equal((await getDocsFromServer(collection(b, 'movimientos'))).size, 1);
});

test('gestión no puede registrar dos liquidaciones simultáneas de la misma comisión', { timeout: 30000 }, async t => {
  await preparar();
  await entorno.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await updateDoc(doc(db, 'usuarios', 'a'), { rol: 'encargada' });
    await setDoc(doc(db, 'ventas', 'comision-compartida'), { id: 'comision-compartida', estado: 'ok',
      uid: 'g', usuario: 'g', fecha, lineas: [{ comision: 4000 }] });
  });
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
  const { posA, posB } = await prepararAdaptadores(t, a, b);
  const reg = { ventas: ['comision-compartida'], vendedor: 'g', desde: '2026-11-21', hasta: '2026-11-21', monto: 4000 };
  const respuestas = await Promise.all([posA.pagarComisiones(reg), posB.pagarComisiones(reg)]);
  assert.equal(respuestas.filter(r => r.ok).length, 1);
  assert.deepEqual((await getDocsFromServer(collection(b, 'comisiones'))).docs.map(s => s.data().monto), [4000]);
});

test('el restablecimiento administrativo de PIN conserva el UID mientras quede una caja abierta', async t => {
  await preparar();
  await entorno.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'cajaAbierta', 'a'), { cajaId: 'a', desde: fecha }));
  const b = entorno.authenticatedContext('b').firestore();
  const a = entorno.authenticatedContext('a').firestore();
  const { posB: admin } = await prepararAdaptadores(t, a, b);
  assert.deepEqual(await admin.cambiarPin('a', '9876'), { ok: false, error: 'caja-abierta' });
  assert.equal((await getDocFromServer(doc(b, 'usuarios', 'a'))).data().activo, true);
});
