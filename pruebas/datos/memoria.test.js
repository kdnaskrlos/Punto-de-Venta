import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearMemoria } from '../../js/datos/memoria.js';
import { semilla } from '../../js/datos/semilla.js';

const existencia = (a, sku) => a._estado('productos').get(sku).existencia;
const ventas = a => [...a._estado('ventas').values()];
const ventaDemo = (id, lineas) => ({
  id, fecha: new Date().toISOString(), cliente: { nombre: 'Ana', telefono: '04121234567' },
  lineas: lineas.map(l => ({ ...l, precioUnit: 1000, subtotal: 1000 * l.cantidad, tramo: 0, comision: 0, reducida: false })),
  subtotal: 1000, descuento: null, total: 1000, pagos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 1000, equivalenteCop: 1000 }], vuelto: null,
  tasas: { copPorUsd: 3900, bsPorUsd: 1075 },
});

async function comoVendedoraConCaja() {
  const a = crearMemoria(semilla());
  assert.equal((await a.entrar('vendedora', '1234')).ok, true);
  assert.equal((await a.abrirCaja({ COP: 50000, USD: 0, BS: 0 })).ok, true);
  return a;
}

test('vender descuenta existencia y registra el movimiento', async () => {
  const a = await comoVendedoraConCaja();
  const v = ventaDemo(a.nuevoId(), [{ sku: 'F-N-6', cantidad: 2 }]);
  assert.deepEqual(await a.guardarVenta(v), { ok: true, offline: false });
  assert.equal(existencia(a, 'F-N-6'), 10);
  const g = ventas(a)[0];
  assert.equal(g.numero, 'V-0001');
  assert.equal(g.usuario, 'vendedora');
  assert.ok(g.cajaId);
  const mov = [...a._estado('movimientos').values()];
  assert.deepEqual(mov.map(m => [m.sku, m.cantidad, m.motivo]), [['F-N-6', -2, 'venta']]);
});

test('doble toque o reintento: una sola venta y un solo descuento (Review Focus 3)', async () => {
  const a = await comoVendedoraConCaja();
  const v = ventaDemo(a.nuevoId(), [{ sku: 'F-N-6', cantidad: 2 }]);
  const [r1, r2] = await Promise.all([a.guardarVenta(v), a.guardarVenta(v)]);
  assert.equal(r1.ok, true); assert.equal(r2.ok, true);
  assert.equal((await a.guardarVenta(v)).ok, true);
  assert.equal(existencia(a, 'F-N-6'), 10);
  assert.equal(ventas(a).length, 1);
});

test('con conexión no se vende más de lo que hay', async () => {
  const a = await comoVendedoraConCaja();
  assert.deepEqual(await a.guardarVenta(ventaDemo(a.nuevoId(), [{ sku: 'F-N-6', cantidad: 6 }, { sku: 'F-N-6', cantidad: 7 }])), { ok: false, faltantes: ['F-N-6'] });
  assert.equal(existencia(a, 'F-N-6'), 12);
});

test('sin conexión se permite y la existencia puede quedar negativa', async () => {
  const a = await comoVendedoraConCaja();
  a.simularSinConexion(true);
  assert.deepEqual(await a.guardarVenta(ventaDemo(a.nuevoId(), [{ sku: 'F-N-6', cantidad: 13 }])), { ok: true, offline: true });
  assert.equal(existencia(a, 'F-N-6'), -1);
  assert.equal(ventas(a)[0].numero, null);
  let estado;
  a.estadoSync(e => { estado = e; });
  assert.deepEqual(estado, { enLinea: false, pendientes: 1, error: null });
  a.simularSinConexion(false);
  assert.deepEqual(estado, { enLinea: true, pendientes: 0, error: null });
  assert.equal(ventas(a)[0].numero, 'V-0001');
});

test('sin caja abierta no se vende', async () => {
  const a = crearMemoria(semilla());
  await a.entrar('encargada', '1234');
  assert.equal((await a.guardarVenta(ventaDemo(a.nuevoId(), [{ sku: 'B-M', cantidad: 1 }]))).error, 'sin-caja');
});

test('permisos: la vendedora no ajusta; la encargada no importa', async () => {
  const a = await comoVendedoraConCaja();
  assert.equal((await a.ajustarExistencia('F-N-6', 5, 'conteo')).error, 'permiso');
  await a.salir();
  await a.entrar('encargada', '1234');
  assert.equal((await a.aplicarImportacion({ nuevos: [], cambios: [], iguales: [], faltantes: [] })).error, 'permiso');
  assert.equal((await a.guardarOferta('Franela AS Niño Negro', { pct: 10, activa: true })).error, 'permiso');
});

test('la vendedora no ve costos ni ventas de otros', async () => {
  const a = await comoVendedoraConCaja();
  let costos, vs;
  a.escuchar('costos', d => { costos = d; });
  assert.deepEqual(costos, []);
  await a.salir(); await a.entrar('encargada', '1234'); await a.abrirCaja({ COP: 0, USD: 0, BS: 0 });
  await a.guardarVenta(ventaDemo(a.nuevoId(), [{ sku: 'B-M', cantidad: 1 }]));
  a.escuchar('costos', d => { costos = d; });
  assert.ok(costos.length > 0);
  await a.salir(); await a.entrar('vendedora', '1234');
  a.escuchar('ventas', d => { vs = d; });
  assert.equal(vs.length, 0);
});

test('apartar reserva, cancelar devuelve (solo gestión)', async () => {
  const a = await comoVendedoraConCaja();
  const ap = { id: a.nuevoId(), fecha: new Date().toISOString(), cliente: { nombre: 'Ana', telefono: '04121234567' }, lineas: [{ sku: 'F-N-6', cantidad: 2, precioUnit: 25000, subtotal: 50000 }], total: 50000,
    abonos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 10000, equivalenteCop: 10000 }] };
  assert.equal((await a.guardarApartado(ap)).ok, true);
  assert.equal(existencia(a, 'F-N-6'), 10);
  const g = a._estado('apartados').get(ap.id);
  assert.equal(g.saldo, 40000); assert.equal(g.estado, 'pendiente');
  assert.equal((await a.abonarApartado(ap.id, { forma: 'efectivo-cop', moneda: 'COP', monto: 5000, equivalenteCop: 5000 })).ok, true);
  assert.equal(a._estado('apartados').get(ap.id).saldo, 35000);
  assert.equal((await a.cancelarApartado(ap.id, 'no vino')).error, 'permiso');
  await a.salir(); await a.entrar('encargada', '1234');
  assert.equal((await a.cancelarApartado(ap.id, 'no vino')).ok, true);
  assert.equal(existencia(a, 'F-N-6'), 12);
  assert.equal(a._estado('apartados').get(ap.id).estado, 'cancelado');
});

test('completar un apartado crea la venta sin volver a descontar', async () => {
  const a = await comoVendedoraConCaja();
  const ap = { id: a.nuevoId(), fecha: new Date().toISOString(), cliente: { nombre: 'Ana', telefono: '04121234567' }, lineas: [{ sku: 'F-N-6', cantidad: 2, precioUnit: 25000, subtotal: 50000 }], total: 50000, abonos: [] };
  await a.guardarApartado(ap);
  const v = { ...ventaDemo(a.nuevoId(), [{ sku: 'F-N-6', cantidad: 2 }]), total: 50000, pagos: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 50000, equivalenteCop: 50000 }] };
  assert.equal((await a.completarApartado(ap.id, v)).ok, true);
  assert.equal(existencia(a, 'F-N-6'), 10);
  assert.equal(a._estado('apartados').get(ap.id).estado, 'completado');
  assert.equal(ventas(a)[0].desdeApartado, ap.id);
});

test('anular devuelve existencias (solo gestión)', async () => {
  const a = await comoVendedoraConCaja();
  const v = ventaDemo(a.nuevoId(), [{ sku: 'F-N-6', cantidad: 2 }]);
  await a.guardarVenta(v);
  assert.equal((await a.anularVenta(v.id, 'error')).error, 'permiso');
  await a.salir(); await a.entrar('encargada', '1234');
  assert.equal((await a.anularVenta(v.id, 'error')).ok, true);
  assert.equal(existencia(a, 'F-N-6'), 12);
  const caja = a._estado('cajas').get(ventas(a)[0].cajaId);
  assert.deepEqual(caja.movimientos.map(m => [m.tipo, m.forma, m.monto]), [['salida', 'efectivo-cop', 1000]]);
  assert.equal(ventas(a)[0].estado, 'anulada');
  assert.equal((await a.anularVenta(v.id, 'otra vez')).error, 'ya-anulada');
});

test('importar como admin: crea productos, guarda historial de costo y no toca existencias', async () => {
  const a = crearMemoria(semilla());
  await a.entrar('admin', '1234');
  const actual = a._estado('productos').get('F-N-6');
  const r = await a.aplicarImportacion({
    nuevos: [{ ...actual, sku: 'NUEVO-1', existencia: 7, costo: 5000 }],
    cambios: [{ sku: 'F-N-6', campos: { costo: 9500, precios: [26000, 24000, 22500, 20000, null] } }], iguales: [], faltantes: [],
  });
  assert.equal(r.ok, true);
  assert.equal(existencia(a, 'NUEVO-1'), 7);
  assert.equal(existencia(a, 'F-N-6'), 12);
  assert.equal(a._estado('productos').get('F-N-6').precios[0], 26000);
  assert.equal(a._estado('costos').get('F-N-6').historial.length, 2);
  assert.equal(a._estado('costos').get('F-N-6').costo, 9500);
  assert.equal(a._estado('costos').get('NUEVO-1').costo, 5000);
  assert.ok(!('costo' in a._estado('productos').get('NUEVO-1')));
});

test('caja: una sola abierta por usuario, cerrada no se edita, solo admin reabre', async () => {
  const a = await comoVendedoraConCaja();
  assert.equal((await a.abrirCaja({ COP: 0, USD: 0, BS: 0 })).error, 'ya-abierta');
  const caja = [...a._estado('cajas').values()][0];
  assert.equal((await a.movimientoCaja(caja.id, { tipo: 'salida', forma: 'efectivo-cop', monto: 1000, motivo: 'gasto' })).ok, true);
  assert.equal((await a.cerrarCaja(caja.id, { contado: { 'efectivo-cop': 49000 }, nota: '' })).ok, true);
  assert.equal((await a.movimientoCaja(caja.id, { tipo: 'salida', forma: 'efectivo-cop', monto: 1, motivo: 'x' })).error, 'cerrada');
  assert.equal((await a.reabrirCaja(caja.id)).error, 'permiso');
  await a.salir(); await a.entrar('admin', '1234');
  assert.equal((await a.reabrirCaja(caja.id)).ok, true);
});

test('entrar: usuario inexistente, PIN malo, desactivado', async () => {
  const a = crearMemoria(semilla());
  assert.equal((await a.entrar('nadie', '1234')).error, 'no-existe');
  assert.equal((await a.entrar('vendedora', '9999')).error, 'pin');
  await a.entrar('admin', '1234');
  const uid = [...a._estado('usuarios').values()].find(u => u.usuario === 'vendedora').uid;
  assert.equal((await a.activarUsuario(uid, false)).ok, true);
  await a.salir();
  assert.equal((await a.entrar('vendedora', '1234')).error, 'inactivo');
});

test('autorización de descuento: la pide la vendedora, solo el admin responde', async () => {
  const a = await comoVendedoraConCaja();
  const { id } = await a.solicitarAutorizacion({ pct: 10, motivo: 'cliente frecuente' });
  await a.salir(); await a.entrar('encargada', '1234');
  assert.equal((await a.responderAutorizacion(id, true)).error, 'permiso');
  await a.salir(); await a.entrar('admin', '1234');
  assert.equal((await a.responderAutorizacion(id, true)).ok, true);
  assert.equal(a._estado('autorizaciones').get(id).estado, 'aprobada');
  assert.equal(a._estado('autorizaciones').get(id).aprueba, 'admin');
});

test('cambiar el PIN propio exige el actual; el admin cambia el de otros', async () => {
  const a = crearMemoria(semilla());
  await a.entrar('vendedora', '1234');
  const yo = [...a._estado('usuarios').values()].find(u => u.usuario === 'vendedora').uid;
  assert.equal((await a.cambiarPin(yo, '5678', '0000')).error, 'pin');
  assert.equal((await a.cambiarPin(yo, '5678', '1234')).ok, true);
  await a.salir();
  assert.equal((await a.entrar('vendedora', '5678')).ok, true);
  await a.salir(); await a.entrar('admin', '1234');
  assert.equal((await a.cambiarPin(yo, '4321')).ok, true);
  await a.salir();
  assert.equal((await a.entrar('vendedora', '4321')).ok, true);
});

test('el sistema de demostración ya viene iniciado', async () => {
  assert.equal(await crearMemoria(semilla()).sistemaIniciado(), true);
});

test('escuchar con filtro por fecha y por usuario', async () => {
  const a = await comoVendedoraConCaja();
  const v1 = { ...ventaDemo(a.nuevoId(), [{ sku: 'F-N-6', cantidad: 1 }]), fecha: '2026-11-10T15:00:00.000Z' };
  const v2 = { ...ventaDemo(a.nuevoId(), [{ sku: 'F-N-6', cantidad: 1 }]), fecha: '2026-11-12T15:00:00.000Z' };
  await a.guardarVenta(v1); await a.guardarVenta(v2);
  let vs;
  a.escuchar('ventas', d => { vs = d; }, { desde: '2026-11-11T00:00:00.000Z' });
  assert.deepEqual(vs.map(v => v.id), [v2.id]);
  a.escuchar('ventas', d => { vs = d; }, { usuario: 'otra' });
  assert.equal(vs.length, 0);
});

test('la vendedora ve sus propias solicitudes de autorización (revisión 2)', async () => {
  const a = await comoVendedoraConCaja();
  const { id } = await a.solicitarAutorizacion({ pct: 10, motivo: 'x' });
  let lista;
  a.escuchar('autorizaciones', d => { lista = d; });
  assert.deepEqual(lista.map(x => x.id), [id]);
  assert.ok(await a.obtener('autorizaciones', id));
});

test('un abono reintentado con el mismo id no se cuenta dos veces; no se abona más que el saldo (revisión final)', async () => {
  const a = await comoVendedoraConCaja();
  const ap = { id: a.nuevoId(), fecha: new Date().toISOString(), cliente: { nombre: 'Ana', telefono: '04121234567' }, lineas: [{ sku: 'F-N-6', cantidad: 1, precioUnit: 25000, subtotal: 25000 }], total: 25000, abonos: [] };
  await a.guardarApartado(ap);
  const pago = { id: 'ab1', forma: 'efectivo-cop', moneda: 'COP', monto: 5000, equivalenteCop: 5000 };
  await a.abonarApartado(ap.id, pago); await a.abonarApartado(ap.id, pago);
  assert.equal(a._estado('apartados').get(ap.id).abonos.length, 1);
  assert.equal(a._estado('apartados').get(ap.id).saldo, 20000);
  assert.equal((await a.abonarApartado(ap.id, { id: 'ab2', forma: 'efectivo-cop', moneda: 'COP', monto: 30000, equivalenteCop: 30000 })).error, 'excede');
});
