// Contrato del almacén. memoria.js (demo/pruebas) y firebase.js lo cumplen igual.
// Todas las operaciones son async y devuelven {ok:true, ...} o {ok:false, error}.
// error ∈ 'sesion' | 'permiso' | 'sin-caja' | 'ya-abierta' | 'cerrada' | 'no-existe' | 'pin' | 'inactivo' | 'red' | 'ya-anulada' | 'estado'
//
// Sesión:      sistemaIniciado() · crearAdministrador({nombre, usuario, pin}) · entrar(usuario, pin) · salir()
//              alCambiarSesion(cb({uid, usuario, nombre, rol}|null)) → desuscribir
// Usuarios:    crearUsuario({usuario, nombre, rol, pin}) · cambiarPin(uid, pinNuevo, pinActual?) → {uid} · activarUsuario(uid, activo) · editarPerfil(uid, {nombre, foto})
// Lectura:     escuchar(nombre, cb(docs[]), filtro?) → desuscribir · obtener(nombre, id)
//              filtro = {desde?, hasta? (ISO, sobre fecha/abierta), usuario?, cajaId?, sku?, estado?, pendientesLocales? (vista de apartados)}
//              La vendedora solo recibe sus propias ventas, cajas y autorizaciones (por usuario).
//              nombres: productos, ventas, apartados, cajas, autorizaciones, ajustes, clientes,
//                       comisiones, costos, costosVenta, movimientos, usuarios
// Ventas:      nuevoId() · guardarVenta(venta) → {ok, offline, estadoSync?} | {ok:false, faltantes:[sku]} · anularVenta(id, motivo)
// Firebase:    estadoSync de venta/reserva/abono/completar = local_pendiente, confirmada_servidor o rechazada_conflicto.
//              Un resultado local conserva el comprobante y requiere conciliación, aunque el cliente aparente estar conectado.
// Apartados:   guardarApartado(ap) · abonarApartado(id, {id, pagos, fecha, tasas}) · abonarApartado(id, pagoHistorico) · completarApartado(id, venta) · cancelarApartado(id, motivo)
// Caja:        abrirCaja(fondo) · movimientoCaja(cajaId, mov) · cerrarCaja(cajaId, cierre) · reabrirCaja(cajaId)
// Inventario:  ajustarExistencia(sku, cantidad, motivo, nota) · aplicarImportacion(plan) · guardarOferta(grupo, oferta) · guardarImagen(codigo, blob)
// Otros:       guardarAjustes(doc, datos) · guardarCliente({telefono, nombre}) · solicitarAutorizacion(a, id?) → {id} · responderAutorizacion(id, aprobada)
//              pagarComisiones(reg) · congelarCostoVenta(ventaId, costo) · estadoSync(cb({enLinea, pendientes, error})) → desuscribir
export const NOMBRES = ['productos', 'ventas', 'apartados', 'cajas', 'autorizaciones', 'ajustes', 'clientes', 'comisiones', 'costos', 'costosVenta', 'movimientos', 'usuarios', 'conflictos', 'eventos'];

export function nuevoId() {
  const r = globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2));
  return r.replace(/-/g, '').slice(0, 20);
}
