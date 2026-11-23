// FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 NODE_PATH=/ruta/a/herramientas node --test pruebas/firebase/cobros.cjs
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:[1-9]\d{0,4}$/.test(host || '')) throw new Error('BLOQUEADO: requiere Firestore Emulator en 127.0.0.1');
const { assertFails, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { collection, doc, getDocsFromServer, getDocFromServer, increment, writeBatch, setDoc, disableNetwork, enableNetwork, onSnapshot } = require('firebase/firestore');

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
    for (const sku of ['ultimo', ...skus]) lote.set(doc(db, 'productos', sku), { existencia: 1 });
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
  await ajuste.commit();
  assert.equal((await getDocFromServer(doc(admin, 'productos', 'ultimo'))).data().existencia, -1);
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

async function adaptadorReal(dbPorUsuario) {
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
  };
  try { return await import(pathToFileURL(archivo).href); }
  finally { hooks.deregister(); }
}

test('el adaptador del POS conserva caja, pagos y fecha del segundo cobro y registra su conflicto', { timeout: 45000 }, async t => {
  await preparar();
  const a = entorno.authenticatedContext('a').firestore(), b = entorno.authenticatedContext('b').firestore();
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
  t.after(() => { delete globalThis.posSdkEmulado; });
  const { crearFirebase } = await adaptadorReal({ a, b });
  const { leerPendientes, revisarPendientes } = await import('../../js/datos/pendientes.js');
  const posA = crearFirebase({ uid: 'a' }), posB = crearFirebase({ uid: 'b' });
  const [, sesionB] = await Promise.all([posA, posB].map(pos => new Promise(r => pos.alCambiarSesion(s => { if (s) r(s); }))));
  const producto = doc(a, 'productos', 'ultimo');
  await Promise.all([getDocFromServer(producto), getDocFromServer(doc(b, 'productos', 'ultimo'))]);
  await Promise.all([disableNetwork(a), disableNetwork(b)]);

  const venta = { fecha, lineas: [{ sku: 'ultimo', cantidad: 1 }], total: 22000, pagos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 22000 }] };
  const [primera, segunda] = await Promise.all([posA.guardarVenta({ ...venta, id: 'pos-a' }), posB.guardarVenta({ ...venta, id: 'pos-b' })]);
  assert.deepEqual([primera.estadoSync, segunda.estadoSync], ['local_pendiente', 'local_pendiente']);
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
