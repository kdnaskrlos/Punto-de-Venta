import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { leerPendientes, revisarPendientes } from '../../js/datos/pendientes.js';

const fuente = new URL('../../js/datos/firebase.js', import.meta.url);
const adaptadores = new Map();
for (const [, nombres, url] of readFileSync(fuente, 'utf8').matchAll(/import \{ ([^}]+) \} from '(https:\/\/www\.gstatic\.com\/firebasejs\/[^']+)'/g)) {
  const modulo = nombres.split(', ').map(n => `export const ${n} = (...a) => globalThis.sdkCobro.${n}(...a);`).join('\n');
  adaptadores.set(url, 'data:text/javascript,' + encodeURIComponent(modulo));
}
const hooks = registerHooks({
  resolve(specifier, contexto, siguiente) {
    if (adaptadores.has(specifier)) return { url: adaptadores.get(specifier), shortCircuit: true };
    return siguiente(specifier, contexto);
  },
});
const { crearFirebase } = await import(fuente);
hooks.deregister();

const perfil = { uid: 'uid-1', usuario: 'ana', nombre: 'Ana', rol: 'vendedora', activo: true };
const venta = { id: 'ticket-1', fecha: '2026-11-21T20:00:00Z', cliente: { nombre: 'Cliente sintético' },
  total: 22000, lineas: [{ sku: 'ultimo', cantidad: 1 }], pagos: [{ forma: 'efectivo-cop', monto: 22000 }] };
const captura = ({ id }, datos, metadata = {}) => ({ id, exists: () => datos != null, data: () => datos, metadata });

function entorno(t) {
  const documentos = new Map([
    ['productos/ultimo', { existencia: 1 }],
    ['apartados/ap1', { id: 'ap1', estado: 'pendiente', saldo: 22000, total: 22000, abonos: [], cliente: venta.cliente }],
  ]);
  const almacenamiento = new Map();
  const commits = [], transacciones = [];
  const clave = ref => ref.path;
  function lote() {
    const ops = [];
    const b = {
      set: (r, d) => ops.push([r, d, false]),
      update: (r, d) => ops.push([r, d, true]),
      commit() {
        const resolucion = Promise.withResolvers();
        commits.push({
          ops,
          confirmar() {
            for (const [r, d, actualizar] of ops) {
              const previo = documentos.get(clave(r)) || {};
              const datos = Object.fromEntries(Object.entries(d).map(([k, v]) => {
                if (v?.inc != null) return [k, (previo[k] || 0) + v.inc];
                if (v?.unir) return [k, [...(previo[k] || []), ...v.unir]];
                return [k, v];
              }));
              documentos.set(clave(r), actualizar ? { ...previo, ...datos } : datos);
            }
            resolucion.resolve();
          },
          rechazar: resolucion.reject,
        });
        return resolucion.promise;
      },
    };
    return b;
  }
  const globals = {
    addEventListener() {},
    navigator: { onLine: true, userAgent: 'Chromium prueba' },
    localStorage: {
      getItem: k => almacenamiento.get(k) ?? null, setItem: (k, v) => almacenamiento.set(k, v),
      removeItem: k => almacenamiento.delete(k), key: i => [...almacenamiento.keys()][i], get length() { return almacenamiento.size; },
    },
    sdkCobro: {
      initializeApp: () => ({}), initializeFirestore: () => ({}), getAuth: () => ({}),
      persistentLocalCache: () => ({}), persistentMultipleTabManager: () => ({}),
      onAuthStateChanged: (_auth, cb) => cb({ uid: perfil.uid }),
      doc: (_db, ...partes) => ({ col: partes[0], id: partes.at(-1), path: partes.join('/') }),
      collection: (_db, col) => ({ col }), where: () => null, query: ref => ref,
      onSnapshot(ref, opciones, callback) {
        const cb = typeof opciones === 'function' ? opciones : callback;
        if (ref.col === 'usuarios') cb(captura(ref, perfil));
        if (ref.col === 'cajas') cb({ docs: [captura(ref, { id: 'caja-1', estado: 'abierta' })] });
        if (ref.col === 'ventas' && !ref.id) cb({ docs: [] });
        return () => {};
      },
      getDocFromCache: async ref => captura(ref, documentos.get(clave(ref))),
      getDoc: async ref => captura(ref, documentos.get(clave(ref))),
      getDocFromServer: async ref => captura(ref, documentos.get(clave(ref))),
      runTransaction: (_db, fn) => {
        const resolucion = Promise.withResolvers();
        transacciones.push({ fn, ...resolucion });
        return resolucion.promise;
      },
      serverTimestamp: () => null, increment: inc => ({ inc }), arrayUnion: (...unir) => ({ unir }), writeBatch: lote,
      waitForPendingWrites: async () => {},
    },
  };
  for (const [k, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { configurable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, k, descriptor) : delete globalThis[k]);
  }
  return { api: crearFirebase({ projectId: 'demo-pos-bloque1' }), commits, transacciones, documentos, almacenamiento };
}
const ciclo = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
const pendiente = /ticket-1/;
const origen = () => leerPendientes('ana');

test('no confirma dos veces el mismo ID ni inicia otra escritura al agotar los cuatro segundos', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { api, commits, transacciones } = entorno(t);
  const primero = api.guardarVenta(venta);
  const doble = api.guardarVenta(venta);
  await ciclo();
  t.mock.timers.tick(4000);
  await ciclo();
  t.mock.timers.tick(1200);
  await ciclo();
  const resultados = await Promise.all([primero, doble]);
  assert.deepEqual(resultados.map(x => x.estadoSync), ['local_pendiente', 'local_pendiente']);
  assert.equal(commits.length + transacciones.length, 1);
  assert.equal(origen()[0].datos.fecha, venta.fecha);
});

test('un rechazo tardío conserva comprobante y caja, libera el intento y nunca declara confirmado por el ID', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { api, commits, almacenamiento } = entorno(t);
  navigator.onLine = false;
  const envio = api.guardarVenta(venta);
  await ciclo();
  t.mock.timers.tick(4000);
  await ciclo();
  assert.equal((await envio).estadoSync, 'local_pendiente');
  commits[0].rechazar({ code: 'permission-denied' });
  await ciclo();
  assert.match([...almacenamiento.values()].join('\n'), pendiente);
  assert.equal(origen()[0].datos.cajaId, 'caja-1');
  assert.equal(origen()[0].datos.pagos[0].monto, 22000);
  assert.equal((await api.guardarVenta(venta)).estadoSync, 'rechazada_conflicto');
  assert.equal(commits.length, 1);
});

test('un duplicado después de una confirmación usa comprobación del servidor y conserva el mismo ID', async t => {
  const { api, commits, transacciones } = entorno(t);
  const envio = api.guardarVenta(venta);
  await ciclo();
  if (commits.length) commits[0].confirmar();
  else transacciones[0].resolve({ ok: true, offline: false });
  await ciclo();
  assert.equal((await envio).estadoSync, 'confirmada_servidor');
  assert.equal((await api.guardarVenta(venta)).estadoSync, 'confirmada_servidor');
  assert.equal(commits.length, 1);
});

test('reingreso y reconexión conservan el orden por dispositivo y concilian el rechazo con el comprobante original', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { api, commits, documentos } = entorno(t);
  const una = api.guardarVenta(venta);
  await ciclo();
  const nueva = { ...venta, id: 'ticket-2', fecha: '2026-11-21T20:12:00Z' };
  const otra = api.guardarVenta(nueva);
  await ciclo();
  t.mock.timers.tick(4000);
  await ciclo();
  assert.equal((await una).estadoSync, 'local_pendiente');
  assert.equal((await otra).estadoSync, 'local_pendiente');
  assert.deepEqual(origen().map(p => [p.orden, p.id, p.datos.fecha]), [[1, venta.id, venta.fecha], [2, nueva.id, nueva.fecha]]);
  const reingreso = crearFirebase({ projectId: 'demo-pos-bloque1' });
  assert.equal((await reingreso.guardarVenta(venta)).estadoSync, 'local_pendiente');
  assert.equal(commits.length, 2);
  commits[0].confirmar();
  commits[1].rechazar({ code: 'permission-denied' });
  await ciclo();
  const conciliacion = revisarPendientes({ sesion: perfil, almacen: reingreso });
  await ciclo();
  assert.equal(commits.length, 3);
  commits[2].confirmar();
  await conciliacion;
  assert.deepEqual(origen(), []);
  assert.equal(documentos.get('ventas/ticket-1').cajaId, 'caja-1');
  assert.equal(documentos.has('ventas/ticket-2'), false);
  const conflicto = documentos.get('conflictos/rechazada-venta-ticket-2');
  assert.equal(conflicto.fecha, nueva.fecha);
  assert.equal(conflicto.datos.cajaId, 'caja-1');
  assert.deepEqual(conflicto.datos.pagos, nueva.pagos);
  assert.equal((await reingreso.guardarVenta(nueva)).estadoSync, 'rechazada_conflicto');
  assert.equal(commits.length, 3);
});

test('dos llamadas de abono conservan una sola deducción y un abono en curso no figura confirmado', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { api, commits, documentos } = entorno(t);
  const pago = { id: 'abono-1', forma: 'efectivo-cop', equivalenteCop: 5000, monto: 5000, fecha: venta.fecha };
  const primero = api.abonarApartado('ap1', pago), doble = api.abonarApartado('ap1', pago);
  await ciclo();
  t.mock.timers.tick(4000);
  await ciclo();
  assert.deepEqual((await Promise.all([primero, doble])).map(r => r.estadoSync), ['local_pendiente', 'local_pendiente']);
  assert.equal(commits.length, 1);
  commits[0].confirmar();
  await ciclo();
  const ap = documentos.get('apartados/ap1');
  assert.equal(ap.saldo, 17000);
  assert.deepEqual(ap.abonos.map(a => [a.id, a.cajaId, a.fecha]), [[pago.id, 'caja-1', venta.fecha]]);
});

test('un rechazo inmediato permite reintentar con el mismo ID y no transmite éxito local', async t => {
  const { api, commits } = entorno(t);
  const uno = api.guardarVenta(venta);
  await ciclo();
  commits[0].rechazar({ code: 'permission-denied' });
  assert.deepEqual(await uno, { ok: false, error: 'permiso' });
  assert.deepEqual(origen(), []);
  const dos = api.guardarVenta(venta);
  await ciclo();
  assert.equal(commits.length, 2);
  commits[1].confirmar();
  assert.equal((await dos).estadoSync, 'confirmada_servidor');
});

test('una venta histórica con el mismo ID se confirma tras verificar al servidor, aunque no tenga marca', async t => {
  const { api, commits, documentos } = entorno(t);
  documentos.set('ventas/ticket-1', { ...venta, uid: 'uid-1', usuario: 'ana', cajaId: 'caja-1' });
  const intento = api.guardarVenta(venta);
  await ciclo();
  commits[0].rechazar({ code: 'permission-denied' });
  assert.equal((await intento).estadoSync, 'confirmada_servidor');
  assert.deepEqual(origen(), []);
});

test('sin almacenamiento del comprobante no se anuncia un cobro local ni se envía un lote', async t => {
  const { api, commits } = entorno(t);
  localStorage.setItem = () => { throw new Error('Cuota del dispositivo'); };
  assert.deepEqual(await api.guardarVenta(venta), { ok: false, error: 'sin-almacenamiento' });
  assert.equal(commits.length, 0);
});
