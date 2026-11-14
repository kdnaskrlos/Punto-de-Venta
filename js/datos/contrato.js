// Contrato del almacén. memoria.js (demo/pruebas) y firebase.js lo cumplen igual.
// Todas las operaciones son async y devuelven {ok:true, ...} o {ok:false, error}.
// error ∈ 'sesion' | 'permiso' | 'sin-caja' | 'ya-abierta' | 'cerrada' | 'no-existe' | 'pin' | 'inactivo' | 'red' | 'ya-anulada' | 'estado'
//
// Sesión:      sistemaIniciado() · crearAdministrador({nombre, usuario, pin}) · entrar(usuario, pin) · salir()
//              alCambiarSesion(cb({uid, usuario, nombre, rol}|null)) → desuscribir
// Usuarios:    crearUsuario({usuario, nombre, rol, pin}) · cambiarPin(uid, pinNuevo, pinActual?) → {uid} · activarUsuario(uid, activo)
// Lectura:     escuchar(nombre, cb(docs[]), filtro?) → desuscribir · obtener(nombre, id)
//              filtro = {desde?, hasta? (ISO, sobre fecha/abierta), usuario?, cajaId?, sku?, estado?}
//              La vendedora solo recibe sus propias ventas, cajas y autorizaciones (por usuario).
//              nombres: productos, ventas, apartados, cajas, autorizaciones, ajustes, clientes,
//                       comisiones, costos, costosVenta, movimientos, usuarios
// Ventas:      nuevoId() · guardarVenta(venta) → {ok, offline} | {ok:false, faltantes:[sku]} · anularVenta(id, motivo)
// Apartados:   guardarApartado(ap) · abonarApartado(id, pago) · completarApartado(id, venta) · cancelarApartado(id, motivo)
// Caja:        abrirCaja(fondo) · movimientoCaja(cajaId, mov) · cerrarCaja(cajaId, cierre) · reabrirCaja(cajaId)
// Inventario:  ajustarExistencia(sku, cantidad, motivo, nota) · aplicarImportacion(plan) · guardarOferta(grupo, oferta) · guardarImagen(codigo, blob) · guardarFoto(sku, blob)
// Otros:       guardarAjustes(doc, datos) · guardarCliente({telefono, nombre}) · solicitarAutorizacion(a) · responderAutorizacion(id, aprobada)
//              pagarComisiones(reg) · congelarCostoVenta(ventaId, costo) · estadoSync(cb({enLinea, pendientes, error})) → desuscribir
// Modo prueba: cargarEjemplos({productos, costos, clientes, ventas, apartados}) · quitarEjemplos() (solo admin; todo con demo:true)
export const NOMBRES = ['productos', 'ventas', 'apartados', 'cajas', 'autorizaciones', 'ajustes', 'clientes', 'comisiones', 'costos', 'costosVenta', 'movimientos', 'usuarios'];

export function nuevoId() {
  const r = globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2));
  return r.replace(/-/g, '').slice(0, 20);
}
