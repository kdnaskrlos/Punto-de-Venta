// v2.27 · Registro de actividad (auditoría, punto 7): qué se hizo, en palabras.
// El mismo texto lo usan Firebase y el modo demostración. Cada evento: { tipo, ref, resumen, motivo, antes, despues }.
import { fmtCop, fmtMonto } from '../nucleo/dinero.js';

export const ETIQUETAS = {
  'venta.creada': 'Venta', 'venta.anulada': 'Venta anulada',
  'apartado.creado': 'Apartado', 'apartado.abono': 'Abono', 'apartado.completado': 'Apartado completado', 'apartado.cancelado': 'Apartado cancelado',
  'caja.abierta': 'Caja abierta', 'caja.entrada': 'Entrada de caja', 'caja.salida': 'Salida de caja', 'caja.cerrada': 'Caja cerrada',
  'caja.cierre_automatico': 'Cierre automático', 'caja.arqueada': 'Arqueo', 'caja.reabierta': 'Caja reabierta',
  'inventario.ajuste': 'Ajuste de inventario', 'inventario.importacion': 'Importación', 'oferta.cambiada': 'Oferta', 'foto.subida': 'Foto',
  'ajustes.cambiados': 'Ajustes', 'cliente.guardado': 'Cliente',
  'descuento.pedido': 'Descuento pedido', 'descuento.aprobado': 'Descuento aprobado', 'descuento.rechazado': 'Descuento rechazado',
  'comisiones.pagadas': 'Pago de comisiones',
  'usuario.creado': 'Usuario creado', 'usuario.pin': 'PIN cambiado', 'usuario.comision': 'Comisión del usuario', 'usuario.perfil': 'Perfil editado',
  'usuario.eliminado': 'Usuario eliminado', 'usuario.activado': 'Usuario activado', 'usuario.desactivado': 'Usuario desactivado',
  'conflicto.registrado': 'Conflicto', 'conflicto.revisado': 'Conflicto revisado',
  'sesion.entrada': 'Inició sesión', 'sesion.salida': 'Cerró sesión', 'modo_prueba.cargado': 'Modo prueba', 'modo_prueba.quitado': 'Modo prueba quitado',
};

// Nombres legibles de los campos de Ajustes (lo que no esté aquí se muestra tal cual).
export const CAMPOS_AJUSTES = { copPorUsd: 'Tasa del peso', bsModo: 'Fuente de Bs', bsManual: 'Tasa manual de Bs', bsRecargo: 'Recargo Binance', bsPorUsd: 'Tasa de Bs',
  tramos: 'Tramos de precio', comisiones: 'Comisiones', formasPago: 'Formas de pago', redondeo: 'Redondeo en pesos', redondeoUsd: 'Vuelto en dólares',
  recibo: 'Recibo', tienda: 'Datos de la tienda', descuentoMax: 'Descuento máximo' };
const OCULTOS = new Set(['copActualizada', 'bsManualActualizada']);

// Grupos para filtrar en la pantalla Actividad.
export const GRUPOS = [
  ['ventas', 'Ventas y apartados', t => /^(venta|apartado)\./.test(t)],
  ['caja', 'Caja', t => t.startsWith('caja.')],
  ['inventario', 'Inventario', t => /^(inventario|oferta|foto)\./.test(t)],
  ['ajustes', 'Ajustes y usuarios', t => /^(ajustes|usuario|cliente|descuento|comisiones|modo_prueba)\./.test(t)],
  ['conflictos', 'Conflictos', t => t.startsWith('conflicto.')],
  ['sesion', 'Entradas y salidas', t => t.startsWith('sesion.')],
];
// Los que importan para revisar: van en rojo/ámbar.
export const IMPORTANTES = new Set(['venta.anulada', 'apartado.cancelado', 'caja.reabierta', 'inventario.ajuste', 'usuario.eliminado', 'usuario.pin', 'conflicto.registrado', 'descuento.aprobado', 'ajustes.cambiados']);

const prendas = l => (l || []).reduce((s, x) => s + (x.cantidad || 0), 0);
const cli = d => d?.cliente?.nombre ? ` · ${d.cliente.nombre}` : '';
const monto = p => `${fmtMonto(p.monto, p.moneda)} ${p.moneda === 'COP' ? 'COP' : p.moneda}`;

// Solo las claves que cambiaron (para Ajustes): { antes: {...}, despues: {...} }.
export function diferencias(antes = {}, despues = {}) {
  const a = {}, d = {};
  for (const k of Object.keys(despues)) {
    if (OCULTOS.has(k)) continue;
    if (JSON.stringify(antes?.[k] ?? null) !== JSON.stringify(despues[k] ?? null)) { a[k] = antes?.[k] ?? null; d[k] = despues[k] ?? null; }
  }
  return Object.keys(d).length ? { antes: a, despues: d } : null;
}

export function describir(metodo, args, x = {}) {
  const [a0, a1, a2, a3] = args;
  switch (metodo) {
    case 'guardarVenta': return { tipo: 'venta.creada', ref: { col: 'ventas', id: a0.id }, resumen: `${fmtCop(a0.total)} COP · ${prendas(a0.lineas)} prendas${cli(a0)}${x.offline ? ' · sin conexión' : ''}` };
    case 'guardarApartado': return { tipo: 'apartado.creado', ref: { col: 'apartados', id: a0.id }, resumen: `${fmtCop(a0.total)} COP · ${prendas(a0.lineas)} prendas${cli(a0)}` };
    case 'anularVenta': return { tipo: 'venta.anulada', ref: { col: 'ventas', id: a0, numero: x.venta?.numero || null }, resumen: `${x.venta?.numero || 'Venta'} · ${fmtCop(x.venta?.total || 0)} COP${cli(x.venta)}`, motivo: a1 };
    case 'abonarApartado': return { tipo: 'apartado.abono', ref: { col: 'apartados', id: a0 }, resumen: `${monto(a1)}${cli(x.ap)}` };
    case 'completarApartado': return { tipo: 'apartado.completado', ref: { col: 'apartados', id: a0, venta: a1.id }, resumen: `${fmtCop(a1.total)} COP${cli(a1)}` };
    case 'cancelarApartado': return { tipo: 'apartado.cancelado', ref: { col: 'apartados', id: a0 }, resumen: `${fmtCop(x.ap?.total || 0)} COP${cli(x.ap)}`, motivo: a1 };
    case 'abrirCaja': return { tipo: 'caja.abierta', ref: { col: 'cajas', id: x.id }, resumen: (a1?.tipo === 'personal' ? 'Caja personal' : 'Fondo ' + Object.entries(a0 || {}).filter(([, n]) => n).map(([m, n]) => `${fmtMonto(n, m)} ${m}`).join(' · ')) || 'Sin fondo' };
    case 'movimientoCaja': return { tipo: a1.tipo === 'salida' ? 'caja.salida' : 'caja.entrada', ref: { col: 'cajas', id: a0 }, resumen: `${fmtMonto(a1.monto, x.moneda || 'COP')} ${x.moneda || ''}`.trim(), motivo: a1.motivo || '' };
    case 'cerrarCaja': return { tipo: 'caja.cerrada', ref: { col: 'cajas', id: a0 }, resumen: a1?.totalCop ? `${a1.totalCop > 0 ? 'Sobrante +' : 'Faltante −'}${fmtCop(Math.abs(a1.totalCop))} COP` : 'Cuadró', motivo: a1?.nota || '' };
    case 'cierreAutomatico': return { tipo: 'caja.cierre_automatico', ref: { col: 'cajas', id: a0.id }, resumen: `Caja de @${a0.usuario}` };
    case 'arquearCaja': return { tipo: 'caja.arqueada', ref: { col: 'cajas', id: a0 }, resumen: a1?.totalCop ? `${a1.totalCop > 0 ? 'Sobrante +' : 'Faltante −'}${fmtCop(Math.abs(a1.totalCop))} COP` : 'Cuadró', motivo: a1?.nota || '' };
    case 'reabrirCaja': return { tipo: 'caja.reabierta', ref: { col: 'cajas', id: a0 }, resumen: x.caja ? `Caja de @${x.caja.usuario}` : '' };
    case 'ajustarExistencia': return { tipo: 'inventario.ajuste', ref: { col: 'productos', id: a0 }, resumen: `${x.nombre || a0} · ${a1 > 0 ? '+' : ''}${a1}`, motivo: `${a2 || ''}${a3 ? ': ' + a3 : ''}` };
    case 'aplicarImportacion': return { tipo: 'inventario.importacion', ref: null, resumen: `${a0?.nuevos?.length || 0} nuevos · ${a0?.cambios?.length || 0} con cambios${a1?.existencias ? ` · ${a0?.existencias?.length || 0} existencias` : ''}` };
    case 'guardarOferta': return { tipo: 'oferta.cambiada', ref: { col: 'productos', grupo: a0 }, resumen: a1?.activa && a1?.pct > 0 ? `${x.nombre || a0} · ${a1.pct}% de descuento` : `${x.nombre || a0} · sin oferta` };
    case 'guardarImagen': return { tipo: 'foto.subida', ref: null, resumen: a0 };
    case 'guardarAjustes': return { tipo: 'ajustes.cambiados', ref: { col: 'ajustes', id: a0 }, resumen: Object.keys(x.cambios?.despues || {}).map(k => CAMPOS_AJUSTES[k] || k).join(', '), antes: x.cambios?.antes ?? null, despues: x.cambios?.despues ?? null };
    case 'guardarCliente': return { tipo: 'cliente.guardado', ref: { col: 'clientes', id: x.telefono }, resumen: `${a0.nombre}${x.antes ? ` (antes: ${x.antes})` : ''}` };
    case 'solicitarAutorizacion': return { tipo: 'descuento.pedido', ref: { col: 'autorizaciones', id: x.id }, resumen: `${a0.tipo === 'monto' ? fmtCop(a0.valor) + ' COP' : a0.pct + '%'} sobre ${fmtCop(a0.subtotal || 0)} COP`, motivo: a0.motivo || '' };
    case 'responderAutorizacion': return { tipo: a1 ? 'descuento.aprobado' : 'descuento.rechazado', ref: { col: 'autorizaciones', id: a0 }, resumen: x.a ? `@${x.a.solicita} · ${x.a.tipo === 'monto' ? fmtCop(x.a.valor) + ' COP' : x.a.pct + '%'}` : '' };
    case 'pagarComisiones': return { tipo: 'comisiones.pagadas', ref: { col: 'comisiones', id: x.id }, resumen: `@${a0.vendedor} · ${fmtCop(a0.monto || a0.total || 0)} COP · ${a0.ventas?.length || 0} ventas` };
    case 'crearUsuario': return { tipo: 'usuario.creado', ref: { col: 'usuarios', id: x.uid }, resumen: `@${a0.usuario} · ${a0.rol}` };
    case 'cambiarPin': return { tipo: 'usuario.pin', ref: { col: 'usuarios', id: a0 }, resumen: x.u ? `@${x.u.usuario}` : '' };
    case 'marcarComision': return { tipo: 'usuario.comision', ref: { col: 'usuarios', id: a0 }, resumen: `${x.u ? '@' + x.u.usuario + ' · ' : ''}${a1 ? 'gana comisión' : 'no gana comisión'}` };
    case 'editarPerfil': return { tipo: 'usuario.perfil', ref: { col: 'usuarios', id: a0 }, resumen: `${x.u ? '@' + x.u.usuario + ' · ' : ''}${a1?.nombre || ''}${a1?.foto ? ' · con foto' : ''}` };
    case 'eliminarUsuario': return { tipo: 'usuario.eliminado', ref: { col: 'usuarios', id: a0 }, resumen: x.u ? `@${x.u.usuario}` : '' };
    case 'activarUsuario': return { tipo: a1 ? 'usuario.activado' : 'usuario.desactivado', ref: { col: 'usuarios', id: a0 }, resumen: x.u ? `@${x.u.usuario}` : '' };
    case 'registrarConflicto': return { tipo: 'conflicto.registrado', ref: { col: 'conflictos', id: a0.id }, resumen: `${a0.tipo === 'rechazada' ? 'Rechazada' : 'Inventario'} · ${a0.que}${a0.resumen?.total != null ? ' · ' + fmtCop(a0.resumen.total) + ' COP' : ''}` };
    case 'revisarConflicto': return { tipo: 'conflicto.revisado', ref: { col: 'conflictos', id: a0 }, resumen: '', motivo: a1 || '' };
    case 'entrar': return { tipo: 'sesion.entrada', ref: null, resumen: '' };
    case 'salir': return { tipo: 'sesion.salida', ref: null, resumen: '' };
    case 'cargarEjemplos': return { tipo: 'modo_prueba.cargado', ref: null, resumen: '' };
    case 'quitarEjemplos': return { tipo: 'modo_prueba.quitado', ref: null, resumen: '' };
    default: return null;
  }
}
