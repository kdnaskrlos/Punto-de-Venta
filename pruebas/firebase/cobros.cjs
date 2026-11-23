// FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 NODE_PATH=/ruta/a/herramientas node --test pruebas/firebase/cobros.cjs
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:[1-9]\d{0,4}$/.test(host || '')) throw new Error('BLOQUEADO: requiere Firestore Emulator en 127.0.0.1');
const { assertFails, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, getDocFromServer, increment, writeBatch, setDoc, disableNetwork, enableNetwork, onSnapshot } = require('firebase/firestore');

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

async function preparar() {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async ({ firestore }) => {
    const db = firestore();
    const lote = writeBatch(db);
    for (const [usuario, rol] of [['a', 'vendedora'], ['b', 'admin']]) {
      lote.set(doc(db, 'usuarios', usuario), { uid: usuario, usuario, activo: true, rol });
      lote.set(doc(db, 'cajas', usuario), { id: usuario, uid: usuario, usuario, estado: 'abierta' });
    }
    lote.set(doc(db, 'productos', 'ultimo'), { existencia: 1 });
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
function vender(db, usuario, id, conMarca = true) {
  const b = writeBatch(db), mov = 'mov-' + usuario;
  if (conMarca) b.set(docCobro(db, usuario, 'venta', id), marca('venta', id));
  b.update(doc(db, 'productos', 'ultimo'), { existencia: increment(-1), ultimoMov: mov });
  b.set(doc(db, 'movimientos', mov), { usuario, sku: 'ultimo', cantidad: -1, motivo: 'venta', ref: id });
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
