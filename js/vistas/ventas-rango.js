// Ventas de un rango con su costo congelado (§15) y lista de ventas con "Anular" para gestión.
import { h, icono, abrirVentana, toast, pedirMotivo, unaVez } from '../ui.js';
import { conCaja } from './caja.js';
import { costoVenta } from '../nucleo/costos.js';
import { fmtCop } from '../nucleo/dinero.js';
import { fechaHora, inicioDia, sumarDias } from '../nucleo/fechas.js';

// cb({ventas, costosVenta|null, costos}) cada vez que cambia algo. Devuelve la función para dejar de escuchar.
export function escucharVentasConCosto(ctx, { desde, hasta }, cb) {
  const filtro = { desde: inicioDia(desde), hasta: inicioDia(sumarDias(hasta, 1)) };
  const gestion = ctx.puedeVer('verCostos');
  let ventas = [], costos = null, congelados = gestion ? null : {};
  const congelando = new Set();
  const avisar = () => {
    if (gestion && costos && congelados) {
      // La primera vez que admin o encargada ven una venta, su costo queda congelado.
      for (const v of ventas) {
        if (congelados[v.id] || congelando.has(v.id)) continue;
        congelando.add(v.id);
        ctx.almacen.congelarCostoVenta(v.id, costoVenta(v, costos));
      }
    }
    cb({ ventas, costosVenta: gestion ? (congelados || {}) : null, costos: costos || {} });
  };
  const q = [ctx.almacen.escuchar('ventas', l => { ventas = l; avisar(); }, filtro)];
  if (gestion) {
    q.push(ctx.almacen.escuchar('costos', l => { costos = Object.fromEntries(l.map(c => [c.sku, c])); avisar(); }));
    q.push(ctx.almacen.escuchar('costosVenta', l => { congelados = Object.fromEntries(l.map(c => [c.id, c])); avisar(); }));
  }
  return () => q.forEach(x => x());
}

const hora = iso => new Date(iso).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit' }).replace('a. m.', 'am').replace('p. m.', 'pm');
const NOMBRE_MON = { COP: 'COP', USD: 'USD', BS: 'Bs' };

// Detalle de una venta: prendas, pagos y, para gestión, "Anular venta" (la acción vive aquí, no en la lista).
function abrirDetalle(ctx, v) {
  const anulada = v.estado === 'anulada';
  const filas = (v.lineas || []).map(l => h('div', { class: 'det-fila' }, h('span', {}, h('b', {}, `${l.cantidad}× `), `${l.nombre}${l.talla ? ' · Talla ' + l.talla : ''}`), h('span', { class: 'num' }, fmtCop(l.subtotal ?? l.precioUnit * l.cantidad))));
  const pagos = (v.pagos || []).map(p => h('div', { class: 'det-fila' }, h('span', {}, p.nombre || p.forma), h('span', { class: 'num' }, `${p.moneda === 'COP' ? fmtCop(p.monto) : p.monto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${NOMBRE_MON[p.moneda] || p.moneda}`)));
  const anular = ctx.puedeVer('anularVenta') && !anulada ? h('button', { class: 'btn danger', id: 'det-anular', onclick: e => unaVez(e.currentTarget, async () => {
    const motivo = await pedirMotivo({ titulo: `Anular ${v.numero || 'venta'}`, boton: 'Anular venta', peligro: true });
    if (!motivo) return;
    const r = await conCaja(ctx, () => ctx.almacen.anularVenta(v.id, motivo));
    toast(r.ok ? 'Venta anulada' : r.error === 'sin-caja' ? 'Abre tu caja para registrar la devolución' : 'No se pudo anular', { malo: !r.ok });
    if (r.ok) vent.cerrar();
  })() }, icono('borrar'), 'Anular venta') : null;
  const vent = abrirVentana({ titulo: v.numero || 'Venta', contenido: h('div', { class: 'pila detalle-venta' },
    h('div', { class: 'det-cab' }, h('div', {}, h('b', {}, v.cliente?.nombre || 'Sin cliente'), h('span', { class: 'nota' }, `${fechaHora(v.fecha)}, por @${v.usuario}`)),
      anulada ? h('span', { class: 'est r' }, 'Anulada') : null),
    anulada && v.anulacion?.motivo ? h('div', { class: 'aviso' }, icono('alerta'), `Motivo: ${v.anulacion.motivo}`) : null,
    h('div', { class: 'det-grupo' }, ...filas),
    v.descuento?.monto ? h('div', { class: 'det-fila' }, h('span', {}, 'Descuento'), h('span', { class: 'num' }, `−${fmtCop(v.descuento.monto)}`)) : null,
    h('div', { class: 'det-fila det-total' }, h('span', {}, 'Total'), h('b', { class: 'num' }, fmtCop(v.total))),
    pagos.length ? h('div', { class: 'det-grupo' }, h('span', { class: 'sec-m' }, 'Pagos'), ...pagos) : null),
    acciones: anular ? h('div', { class: 'acciones' }, anular) : null });
}

// Lista de ventas: cada fila se toca para ver el detalle (y ahí, Anular).
export function listaVentas(ctx, ventas, limite = 40) {
  const orden = [...ventas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, limite);
  if (!orden.length) return h('p', { class: 'nota' }, 'Sin ventas en este período.');
  return h('div', { class: 'lista-ventas' }, ...orden.map(v => h('button', { type: 'button', class: 'venta-hoy' + (v.estado === 'anulada' ? ' anulada' : ''), onclick: () => abrirDetalle(ctx, v) },
    h('div', { class: 'vh-info' }, h('b', {}, v.cliente?.nombre || 'Sin cliente'),
      h('div', { class: 'vh-meta' }, h('span', { class: 'num' }, hora(v.fecha)), h('span', { class: 'vh-quien' }, `@${v.usuario}`),
        v.estado === 'anulada' ? h('span', { class: 'est r' }, 'Anulada') : v.offline ? h('span', { class: 'est y' }, 'Sin conexión') : null)),
    h('div', { class: 'vh-der' }, h('b', { class: 'num' }, fmtCop(v.total)), h('span', { class: 'nota num' }, v.numero || '')),
    h('span', { class: 'vh-flecha' }, icono('der')))));
}
