// Ventas de un rango con su costo congelado (§15) y lista de ventas con "Anular" para gestión.
import { h, toast, pedirMotivo } from '../ui.js';
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

export function listaVentas(ctx, ventas) {
  const orden = [...ventas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 40);
  if (!orden.length) return h('p', { class: 'nota' }, 'Sin ventas en este período.');
  return h('div', { class: 'lista-ventas' }, ...orden.map(v => h('div', { class: 'venta-hoy' + (v.estado === 'anulada' ? ' anulada' : '') },
    h('div', { class: 'vh-info' }, h('b', {}, `${v.numero || 'Sin número'} · ${v.cliente?.nombre || '—'}`),
      h('div', { class: 'nota' }, `${fechaHora(v.fecha)} · @${v.usuario}${v.offline ? ' · sin conexión' : ''}${v.estado === 'anulada' ? ` · anulada: ${v.anulacion?.motivo || ''}` : ''}`)),
    h('b', { class: 'num' }, fmtCop(v.total)),
    ctx.puedeVer('anularVenta') && v.estado !== 'anulada' ? h('button', { class: 'btn danger', onclick: async () => {
      const motivo = await pedirMotivo({ titulo: `Anular ${v.numero || 'venta'}`, boton: 'Anular venta', peligro: true });
      if (!motivo) return;
      const r = await ctx.almacen.anularVenta(v.id, motivo);
      toast(r.ok ? 'Venta anulada' : r.error === 'sin-caja' ? 'Abre tu caja para registrar la devolución' : 'No se pudo anular', { malo: !r.ok });
    } }, 'Anular') : null)));
}
