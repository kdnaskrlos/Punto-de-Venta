// Ventas de un rango con su costo congelado (§15) y lista de ventas con "Anular" para gestión.
import { h, icono, abrirVentana, toast, pedirMotivo, unaVez } from '../ui.js';
import { conCaja } from './caja.js';
import { costoVenta } from '../nucleo/costos.js';
import { fmtCop, fmtMonto } from '../nucleo/dinero.js';
import { NOMBRE_MONEDA } from '../nucleo/formas.js';
import { aCop } from '../nucleo/tasas.js';
import { fechaHora, inicioDia, sumarDias } from '../nucleo/fechas.js';

// cb({ventas, costosVenta|null, costos}) cada vez que cambia algo. Devuelve la función para dejar de escuchar.
export function escucharVentasConCosto(ctx, { desde, hasta }, cb) {
  const filtro = { desde: inicioDia(desde), hasta: inicioDia(sumarDias(hasta, 1)) };
  const gestion = ctx.puedeVer('verCostos');
  let ventas = [], costos = null, congelados = gestion ? null : {}, ventasOk = false;
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
    // v2.01: «listo» cuando ya llegaron ventas y, para gestión, los costos (así Reportes pinta una sola vez).
    cb({ ventas, costosVenta: gestion ? (congelados || {}) : null, costos: costos || {}, listo: ventasOk && (!gestion || (!!costos && !!congelados)) });
  };
  const q = [ctx.almacen.escuchar('ventas', l => { ventas = l; ventasOk = true; avisar(); }, filtro)];
  if (gestion) {
    q.push(ctx.almacen.escuchar('costos', l => { costos = Object.fromEntries(l.map(c => [c.sku, c])); avisar(); }));
    q.push(ctx.almacen.escuchar('costosVenta', l => { congelados = Object.fromEntries(l.map(c => [c.id, c])); avisar(); }));
  }
  return () => q.forEach(x => x());
}

const hora = iso => new Date(iso).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit' }).replace('a. m.', 'am').replace('p. m.', 'pm');
const montoConMoneda = (monto, moneda) => Number.isFinite(monto)
  ? moneda ? `${fmtMonto(monto, moneda)} ${NOMBRE_MONEDA[moneda] || moneda}` : `${monto} · Moneda sin registrar`
  : 'No disponible';
const filaMonto = (etiqueta, texto) => h('div', { class: 'det-fila' },
  h('span', {}, etiqueta), h('span', { class: 'num' }, texto));

function sumarCop(partes, tasas) {
  const importes = partes.map(p => Number.isFinite(p.equivalenteCop)
    ? p.equivalenteCop : aCop(p.monto, p.moneda, tasas));
  return importes.every(Number.isFinite) ? importes.reduce((suma, valor) => suma + valor, 0) : null;
}

function datosCobro(v) {
  const pagos = v.pagos || [];
  const vuelto = v.vuelto;
  const partes = (vuelto?.partes ?? (vuelto ? [vuelto] : []))
    .filter(p => Number.isFinite(p.monto) && p.monto > 0);
  const abonos = Number.isFinite(v.abonosPrevios) ? v.abonosPrevios : 0;
  const pagado = sumarCop(pagos, v.tasas);
  const cambio = Number.isFinite(vuelto?.equivalenteCop) ? vuelto.equivalenteCop : sumarCop(partes, v.tasas);
  const neto = pagado === null || cambio === null ? null : pagado + abonos - cambio;
  return { pagos, partes, abonos, cambio, neto: pagos.length || abonos ? neto : null };
}

function detalleCobro(v, cobro) {
  const { pagos, partes, abonos, cambio, neto } = cobro;
  const vuelto = v.vuelto;
  return [
    pagos.length || abonos ? h('div', { class: 'det-grupo' }, h('span', { class: 'sec-m' }, 'Pagos recibidos'),
      ...pagos.map(p => filaMonto(p.nombre || p.forma, montoConMoneda(p.monto, p.moneda))),
      abonos ? filaMonto('Abonos previos', montoConMoneda(abonos, 'COP')) : null) : null,
    partes.length ? h('div', { class: 'det-grupo' }, h('span', { class: 'sec-m' }, 'Vuelto entregado'),
      ...partes.map(p => filaMonto(NOMBRE_MONEDA[p.moneda] || p.moneda, `−${fmtMonto(p.monto, p.moneda)}`)),
      partes.length === 1 && partes[0].moneda === 'COP' ? null
        : filaMonto('Equivalente en COP', cambio === null ? 'No disponible' : montoConMoneda(cambio, 'COP'))) : null,
    Number.isFinite(vuelto?.remanenteCop) && vuelto.remanenteCop !== 0
      ? filaMonto('Ajuste por redondeo', montoConMoneda(vuelto.remanenteCop, 'COP')) : null,
    pagos.length || abonos ? h('div', { class: 'det-fila det-total' }, h('span', {}, v.estado === 'anulada' ? 'Importe neto original' : 'Importe neto cobrado'),
      h('b', { class: 'num' }, neto === null ? 'No disponible' : montoConMoneda(neto, 'COP'))) : null,
    v.estado === 'anulada' && (Number.isFinite(v.tasas?.copPorUsd) || Number.isFinite(v.tasas?.bsPorUsd))
      ? h('div', { class: 'det-grupo' }, h('span', { class: 'sec-m' }, 'Tasas originales'),
        Number.isFinite(v.tasas?.copPorUsd) ? filaMonto('COP por USD', fmtMonto(v.tasas.copPorUsd, 'COP')) : null,
        Number.isFinite(v.tasas?.bsPorUsd) ? filaMonto('Bs por USD', fmtMonto(v.tasas.bsPorUsd, 'BS')) : null) : null,
  ];
}

function mostrarDevolucion(v, cobro, cajas, destino) {
  const { por, fecha } = v.anulacion || {};
  const cuando = Date.parse(fecha);
  // El movimiento histórico registra número, operador y fecha, sin el ID de venta.
  const propios = v.numero && por && Number.isFinite(cuando) ? cajas.flatMap(c => c.movimientos || [])
    .filter(m => m.motivo === `anulación ${v.numero}` && m.usuario === por
      && Math.abs(Date.parse(m.fecha) - cuando) <= 60000
      && ['entrada', 'salida'].includes(m.tipo) && Number.isFinite(m.monto) && m.monto > 0) : [];
  const originales = [...cobro.pagos, ...cobro.partes];
  const movimientos = propios.map(m => {
    const partes = originales.filter(p => p.forma && p.forma === m.forma);
    const monedas = new Set(partes.map(p => p.moneda).filter(Boolean));
    return { ...m, nombre: m.nombre || partes.find(p => p.nombre)?.nombre || m.forma || 'Medio sin registrar',
      moneda: m.moneda || (monedas.size === 1 ? [...monedas][0] : null) };
  });
  const importes = movimientos.map(m => m.moneda ? aCop(m.monto, m.moneda, v.tasas) : null);
  const devuelto = movimientos.length && importes.every(Number.isFinite)
    ? movimientos.reduce((suma, m, i) => suma + (m.tipo === 'salida' ? 1 : -1) * importes[i], 0) : null;
  const final = cobro.neto === null || devuelto === null ? null : cobro.neto - devuelto;
  destino.replaceChildren(h('div', {},
    h('span', { class: 'sec-m' }, 'Devolución registrada'),
    ...movimientos.map(m => filaMonto(m.tipo === 'entrada' ? `${m.nombre} · Entrada` : m.nombre,
      (m.tipo === 'salida' ? '−' : '+') + montoConMoneda(m.monto, m.moneda))),
    movimientos.length ? null : h('p', { class: 'nota' }, 'Sin movimientos de devolución asociados disponibles.'),
    devuelto === null ? null : filaMonto('Devolución neta en COP', montoConMoneda(devuelto, 'COP')),
    h('div', { class: 'det-fila det-total' }, h('span', {}, 'Importe neto final'),
      h('b', { class: 'num' }, final === null ? 'No disponible' : montoConMoneda(final, 'COP')))));
}

// Detalle de una venta: prendas, pagos y, para gestión, "Anular venta" (la acción vive aquí, no en la lista).
function abrirDetalle(ctx, v) {
  const anulada = v.estado === 'anulada';
  const cobro = datosCobro(v);
  const devolucion = anulada ? h('div', { class: 'det-grupo' }) : null;
  const filas = (v.lineas || []).map(l => h('div', { class: 'det-fila' }, h('span', {}, h('b', {}, `${l.cantidad}× `), `${l.nombre}${l.talla ? ' · Talla ' + l.talla : ''}`), h('span', { class: 'num' }, fmtCop(l.subtotal ?? l.precioUnit * l.cantidad))));
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
    h('div', { class: 'det-fila det-total' }, h('span', {}, 'Total de la venta'), h('b', { class: 'num' }, montoConMoneda(v.total, 'COP'))),
    ...detalleCobro(v, cobro), devolucion),
    acciones: anular ? h('div', { class: 'acciones' }, anular) : null });
  if (anulada) {
    mostrarDevolucion(v, cobro, [], devolucion);
    if (v.numero && v.anulacion?.fecha && ctx.almacen?.escuchar) {
      vent.alCerrar = ctx.almacen.escuchar('cajas', cajas => mostrarDevolucion(v, cobro, cajas, devolucion));
    }
  }
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
