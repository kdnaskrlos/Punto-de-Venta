// v2.26 · Revisión de lo guardado sin conexión (C1 / H1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anotarPendiente, leerPendientes, revisarPendientes, revisarUno } from '../../js/datos/pendientes.js';

const almacen = docs => ({ verificarServidor: async (col, id) => docs[`${col}/${id}`] || null });
const venta = { id: 'v1', fecha: '2026-11-15T20:00:00Z', cliente: { nombre: 'Ana' }, total: 50000, lineas: [{ sku: 'A', cantidad: 2 }], pagos: [{ nombre: 'Efectivo pesos', moneda: 'COP', monto: 50000 }] };

test('venta que llegó al servidor y no dejó negativos: ok', async () => {
  assert.equal(await revisarUno(almacen({ 'ventas/v1': venta, 'productos/A': { existencia: 3 } }), { que: 'venta', id: 'v1', offline: true, datos: venta }), 'ok');
});

test('venta que el servidor rechazó: conflicto «rechazada» con el resumen del cobro', async () => {
  const r = await revisarUno(almacen({}), { que: 'venta', id: 'v1', offline: true, datos: venta });
  assert.equal(r.conflicto.tipo, 'rechazada');
  assert.equal(r.conflicto.id, 'rechazada-venta-v1');
  assert.equal(r.conflicto.resumen.total, 50000);
  assert.equal(r.conflicto.resumen.cliente, 'Ana');
  assert.equal(r.conflicto.resumen.prendas, 2);
});

test('venta sin internet que dejó existencia negativa: conflicto de inventario', async () => {
  const r = await revisarUno(almacen({ 'ventas/v1': venta, 'productos/A': { existencia: -1 } }), { que: 'venta', id: 'v1', offline: true, datos: venta });
  assert.equal(r.conflicto.tipo, 'inventario');
  assert.deepEqual(r.conflicto.negativos, [{ sku: 'A', existencia: -1 }]);
});

test('abono: se busca dentro del apartado por su id', async () => {
  const ap = { abonos: [{ id: 'x-0', monto: 10 }] };
  assert.equal(await revisarUno(almacen({ 'apartados/ap1': ap }), { que: 'abono', id: 'x-0', apartadoId: 'ap1', offline: true }), 'ok');
  assert.equal((await revisarUno(almacen({ 'apartados/ap1': ap }), { que: 'abono', id: 'x-1', apartadoId: 'ap1', offline: true })).conflicto.tipo, 'rechazada');
});

test('completar: la venta del apartado debe existir', async () => {
  assert.equal((await revisarUno(almacen({}), { que: 'completar', id: 'v9', apartadoId: 'ap1', offline: true, datos: venta })).conflicto.que, 'completar');
});

test('sin conexión: la revisión lanza y el pendiente no se toca', async () => {
  await assert.rejects(revisarUno({ verificarServidor: async () => { throw new Error('offline'); } }, { que: 'venta', id: 'v1', datos: venta }));
});

test('confirmar una venta conserva el abono anotado mientras se esperaba al servidor', async t => {
  const datos = new Map();
  const globals = {
    localStorage: {
      getItem: clave => datos.get(clave) ?? null,
      setItem: (clave, valor) => datos.set(clave, valor),
      removeItem: clave => datos.delete(clave),
    },
    navigator: { onLine: true },
  };
  for (const [propiedad, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, propiedad);
    Object.defineProperty(globalThis, propiedad, { value, configurable: true });
    t.after(() => original ? Object.defineProperty(globalThis, propiedad, original) : delete globalThis[propiedad]);
  }
  const recibida = Promise.withResolvers(), verificacion = Promise.withResolvers();
  const ctx = {
    sesion: { usuario: 'pruebas' },
    almacen: {
      esperarSubidas: async () => true,
      verificarServidor: async (col, id) => {
        assert.deepEqual([col, id], ['ventas', 'v1']);
        recibida.resolve();
        return verificacion.promise;
      },
    },
  };
  anotarPendiente(ctx, { que: 'venta', id: 'v1' });
  const revision = revisarPendientes(ctx);
  await recibida.promise;
  anotarPendiente(ctx, { que: 'abono', id: 'abono-2', apartadoId: 'ap1' });
  verificacion.resolve({ id: 'v1' });
  await revision;
  assert.deepEqual(leerPendientes('pruebas').map(p => [p.que, p.id, p.apartadoId]), [['abono', 'abono-2', 'ap1']]);
});

test('la demostración reconcilia su cola sin retirar pendientes reales con el mismo usuario', async t => {
  const datos = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: clave => datos.get(clave) ?? null,
    setItem: (clave, valor) => datos.set(clave, valor),
    removeItem: clave => datos.delete(clave),
  } });
  t.after(() => original ? Object.defineProperty(globalThis, 'localStorage', original) : delete globalThis.localStorage);
  const sesion = { uid: 'sintetico', usuario: 'admin' };
  const ctx = { sesion, almacen: {
    esDemostracion: true,
    esperarSubidas: async () => true,
    verificarServidor: async (_col, id) => { assert.equal(id, 'demo'); return { id }; },
    registrarConflicto: async () => ({ ok: true }),
  } };
  anotarPendiente({ sesion }, { que: 'venta', id: 'real-sintetico' });
  anotarPendiente(ctx, { que: 'venta', id: 'demo' });
  await revisarPendientes(ctx);
  assert.deepEqual(leerPendientes('admin').map(p => p.id), ['real-sintetico']);
  assert.deepEqual(leerPendientes('admin', true), []);
});
