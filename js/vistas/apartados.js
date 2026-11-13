// Apartados (§10): apartar desde el carrito, abonar, completar y cancelar.
import { h, icono, abrirVentana, toast, pedirMotivo, despuesDeCerrar } from '../ui.js';
import { conCaja } from './caja.js';
import { cobroAbierto, marcarCobro } from './cobro-abierto.js';
import { registrarVista } from '../app.js';
import { resumenCarrito, carrito, vaciarCarrito, revisarDescuento } from './vender.js';
import { crearPanelPagos } from './pagos.js';
import { resumenCliente, lineasParaGuardar, firmaCarrito } from './cobrar.js';
import { fmtCop, fmtMonto } from '../nucleo/dinero.js';
import { fechaHora } from '../nucleo/fechas.js';

const ESTADO = { pendiente: ['y', 'Pendiente'], completado: ['g', 'Completado'], cancelado: ['n', 'Cancelado'] };
const tasasDe = ctx => ({ copPorUsd: ctx.tasas.copPorUsd, bsPorUsd: ctx.tasas.bsPorUsd, fuenteBs: ctx.tasas.fuenteBs });

export function abrirApartar(ctx) {
  if (cobroAbierto()) return;
  revisarDescuento(ctx);
  const r0 = resumenCarrito(ctx);
  if (!r0.lineas.length) return;
  if (r0.total <= 0) { toast('El total debe ser mayor que 0', { malo: true }); return; }
  const id = ctx.almacen.nuevoId();
  let guardando = false;
  const final = h('button', { class: 'btn primary grande', id: 'apartar-final' }, 'Apartar');
  const actualizar = () => {
    const e = panel.estado();
    const abono = Math.min(e.pagadoCop, r0.total);
    final.textContent = abono ? `Apartar · abono ${fmtCop(abono)}` : 'Apartar sin abono';
    final.disabled = guardando || e.vueltoCop > 0 || e.pagos.some(p => p.equivalenteCop == null);
  };
  const cliente = resumenCliente(ctx);
  const panel = crearPanelPagos(ctx, { total: r0.total, permitirMenos: true, alCambiar: () => actualizar() });
  const v = abrirVentana({ titulo: 'Apartar', pantallaCompleta: true,
    contenido: h('div', { class: 'cobro' }, cliente.el, h('div', { class: 'total-cobro' }, h('span', { class: 'total-cop num' }, fmtCop(r0.total)), h('span', { class: 'moneda c-cop' }, 'COP')), h('p', { class: 'nota' }, 'El abono es opcional. Las prendas quedan reservadas.'), panel.el),
    acciones: h('div', { class: 'pie-cobro' }, panel.barra, final) });
  v.alCerrar = () => cliente.quitar();
  marcarCobro(v);
  actualizar();
  final.addEventListener('click', async () => {
    if (guardando) return;
    guardando = true; actualizar();
    const r = resumenCarrito(ctx);
    if (firmaCarrito(r) !== firmaCarrito(r0)) { guardando = false; v.cerrar(); toast('Los precios cambiaron, revisa el apartado', { malo: true }); return; }
    const c = carrito(ctx);
    const { pagos } = panel.resultado();
    const ap = {
      id, fecha: new Date().toISOString(), cliente: { ...carrito(ctx).cliente }, lineas: lineasParaGuardar(ctx, r),
      subtotal: r.subtotal, descuento: r.descuento ? { tipo: c.descuento.tipo, valor: c.descuento.valor, monto: r.descuento, autorizadoPor: c.autorizacion?.por || null } : null,
      total: r.total, abonos: pagos, tasas: tasasDe(ctx),
    };
    const res = await conCaja(ctx, () => ctx.almacen.guardarApartado(ap));
    guardando = false;
    if (!res.ok) { toast(res.faltantes ? 'Ya no hay existencia de alguna prenda' : res.error === 'sin-caja' ? 'Abre tu caja para apartar' : 'No se pudo apartar', { malo: true }); actualizar(); return; }
    ctx.almacen.guardarCliente(ap.cliente);
    vaciarCarrito(ctx); window.dispatchEvent(new CustomEvent('pos:carrito'));
    v.cerrar(); toast('Apartado creado');
  });
}

function abrirPago(ctx, ap, modo) {
  const completar = modo === 'completar';
  let guardando = false;
  const final = h('button', { class: 'btn primary grande', id: completar ? 'completar-final' : 'abono-final' }, completar ? `Cobrar saldo ${fmtCop(ap.saldo)}` : 'Registrar abono');
  const panel = crearPanelPagos(ctx, { total: ap.saldo, permitirMenos: !completar, alCambiar: () => actualizar() });
  const actualizar = () => {
    const e = panel.estado();
    final.disabled = guardando || (completar ? !e.cuadra : (e.pagadoCop <= 0 || e.vueltoCop > 0));
  };
  const v = abrirVentana({ titulo: completar ? 'Completar apartado' : 'Abonar', pantallaCompleta: true,
    contenido: h('div', { class: 'cobro' }, h('p', {}, h('b', {}, ap.cliente.nombre), ` · total ${fmtCop(ap.total)} · saldo `, h('b', { class: 'num' }, fmtCop(ap.saldo))), panel.el),
    acciones: h('div', { class: 'pie-cobro' }, panel.barra, final) });
  actualizar();
  const idVenta = ctx.almacen.nuevoId();
  final.addEventListener('click', async () => {
    if (guardando) return;
    guardando = true; actualizar();
    const { pagos, vuelto } = panel.resultado();
    let res;
    if (completar) {
      res = await conCaja(ctx, () => ctx.almacen.completarApartado(ap.id, {
        id: idVenta, fecha: new Date().toISOString(), cliente: ap.cliente, lineas: ap.lineas, subtotal: ap.subtotal, descuento: ap.descuento,
        total: ap.total, abonosPrevios: ap.total - ap.saldo, pagos, vuelto, tasas: tasasDe(ctx),
      }));
    } else {
      // Cada abono lleva un id fijo: si algo falla y se reintenta, los ya guardados no se repiten.
      const actual = await ctx.almacen.obtener('apartados', ap.id) || ap;
      const suma = pagos.reduce((s, p) => s + (p.equivalenteCop || 0), 0);
      if (suma > actual.saldo + 50) res = { ok: false, error: 'excede' };
      else {
        res = { ok: true };
        for (const [i, p] of pagos.entries()) { const r = await conCaja(ctx, () => ctx.almacen.abonarApartado(ap.id, { ...p, id: `${idVenta}-${i}` })); if (!r.ok) { res = r; break; } }
      }
    }
    guardando = false;
    if (!res.ok) { toast(res.error === 'sin-caja' ? 'Abre tu caja primero' : res.error === 'excede' ? 'El abono es mayor que el saldo actual' : 'No se pudo guardar', { malo: true }); actualizar(); return; }
    v.cerrar(); toast(completar ? 'Venta guardada' : 'Abono guardado');
  });
}

// Días desde que se apartó (para notar los que llevan mucho tiempo).
const diasDesde = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
const telLegible = t => { const d = String(t || ''); return d.startsWith('58') && d.length === 12 ? `0${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : d; };

const fechaCorta = iso => fechaHora(iso).split(' · ')[0];
const resumenPrendas = ap => {
  const n = ap.lineas.reduce((s, l) => s + l.cantidad, 0);
  const primera = ap.lineas[0] ? `${ap.lineas[0].nombre}${ap.lineas[0].talla ? ' ' + ap.lineas[0].talla : ''}` : '';
  return `${n} ${n === 1 ? 'prenda' : 'prendas'} · ${primera}${ap.lineas.length > 1 ? ` y ${ap.lineas.length - 1} más` : ''}`;
};

const diaCorto = iso => { const t = fechaHora(iso).split(' · ')[0].split(' '); return `${t[0].slice(0, 3)}. ${t[1]} ${t[2]}.`; };
// Tarjeta compacta: a la izquierda quién y qué; a la derecha cuánto falta y el estado.
function tarjeta(ctx, ap) {
  const [color, etiqueta] = ESTADO[ap.estado] || ESTADO.pendiente;
  const pendiente = ap.estado === 'pendiente';
  const dias = diasDesde(ap.fecha);
  const nombre = ap.cliente?.nombre || '—';
  const viejo = pendiente && dias >= 15;
  return h('button', { type: 'button', class: `apartado ap-${ap.estado}${viejo ? ' viejo' : ''}`, 'data-id': ap.id, onclick: () => abrirDetalle(ctx, ap) },
    h('span', { class: 'ap-main' },
      h('b', { class: 'ap-nombre' }, nombre),
      h('span', { class: 'ap-l2' }, resumenPrendas(ap)),
      h('span', { class: 'ap-l3' }, diaCorto(ap.fecha), viejo ? h('span', { class: 'ap-dias' }, ` · ${dias} días`) : null)),
    h('span', { class: 'ap-der' },
      h('span', { class: `est ${pendiente ? 'r' : color}` }, pendiente ? 'Por cobrar' : etiqueta),
      h('b', { class: 'ap-saldo num' + (pendiente ? '' : ' cerrado') }, fmtCop(pendiente ? ap.saldo : ap.total))),
    icono('der'));
}

// Detalle del apartado: saldo y abonado arriba, prendas, último abono (con historial) y acciones.
function abrirDetalle(ctx, ap) {
  const [color, etiqueta] = ESTADO[ap.estado] || ESTADO.pendiente;
  const pendiente = ap.estado === 'pendiente';
  const abonado = ap.total - ap.saldo;
  const pct = ap.total ? Math.min(100, Math.round((abonado / ap.total) * 100)) : 0;
  const ir = fn => { v.cerrar(); despuesDeCerrar(fn); };
  const abonos = ap.abonos || [];
  const ultimo = abonos[abonos.length - 1];
  const textoAbono = x => `${fmtMonto(x.monto, x.moneda)}${x.moneda === 'COP' ? '' : ' ' + (x.moneda === 'BS' ? 'Bs' : x.moneda)}`;
  const historial = () => abrirVentana({ titulo: 'Historial de abonos', contenido: h('div', { class: 'ap-det-caja' }, ...[...abonos].reverse().map(x => h('div', { class: 'ap-det-fila' },
    h('span', {}, x.nombre || x.forma, h('span', { class: 'nota' }, x.fecha ? ` · ${fechaHora(x.fecha)}` : '')), h('b', { class: 'num' }, textoAbono(x))))) });
  const contenido = h('div', { class: 'ap-det' },
    h('div', { class: 'ap-det-cab' },
      h('div', {}, h('h2', { class: 'ap-det-nombre' }, ap.cliente?.nombre || 'Apartado'),
        ap.cliente?.telefono ? h('span', { class: 'ap-det-tel nota num' }, icono('telefono'), telLegible(ap.cliente.telefono)) : null),
      h('span', { class: 'ap-det-cab-der' }, h('span', { class: `est ${color}` }, etiqueta), h('button', { class: 'ibtn cerrar', 'aria-label': 'Cerrar' }, icono('x')))),
    h('div', { class: 'ap-det-pago' },
      h('div', { class: 'ap-det-cifras' },
        h('div', {}, h('span', { class: 'nota' }, pendiente ? 'Saldo pendiente' : 'Total'), h('b', { class: 'num grande' + (pendiente ? ' rojo' : '') }, fmtCop(pendiente ? ap.saldo : ap.total))),
        h('div', { class: 'sep' }),
        h('div', {}, h('span', { class: 'nota' }, 'Total abonado'), h('b', { class: 'num' }, fmtCop(abonado)), h('small', {}, `de ${fmtCop(ap.total)}`))),
      h('div', { class: 'ap-barra', role: 'progressbar', 'aria-label': 'Pagado', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: `width:${pct}%` }))),
    h('h3', { class: 'ap-det-t' }, icono('franela'), 'Prendas'),
    h('div', { class: 'ap-det-caja' }, ...ap.lineas.map(l => h('div', { class: 'ap-det-fila prenda' },
      h('span', { class: 'ap-det-pn' }, `${l.cantidad} × ${l.nombre}`),
      l.talla ? h('span', { class: 'ap-det-talla' }, `Talla ${l.talla}`) : h('span', {}),
      h('span', { class: 'num' }, l.subtotal != null ? fmtCop(l.subtotal) : '')))),
    ultimo ? h('div', { class: 'ap-det-abono' },
      h('h3', { class: 'ap-det-t' }, icono('cartera'), 'Último abono'),
      h('div', { class: 'ap-det-fila' }, h('span', {}, ultimo.nombre || ultimo.forma, h('span', { class: 'nota' }, ultimo.fecha ? ` · ${diaCorto(ultimo.fecha).replace(/\.$/, '')}` : '')), h('b', { class: 'num' }, textoAbono(ultimo))),
      abonos.length ? h('button', { type: 'button', class: 'enlace-ver', id: 'ap-historial', onclick: historial }, `Ver historial de abonos (${abonos.length})`, icono('der')) : null) : null,
    h('p', { class: 'nota ap-det-meta' }, icono('calendario'), `Apartado el ${fechaHora(ap.fecha).replace(/^\S+ /, '')} · @${ap.usuario}`));
  const acciones = pendiente ? h('div', { class: 'acciones ap-acc' },
    ctx.puedeVer('cancelarApartado') ? h('button', { class: 'btn danger', id: 'ap-cancelar', onclick: () => ir(async () => {
      const motivo = await pedirMotivo({ titulo: 'Cancelar apartado', boton: 'Cancelar apartado', peligro: true });
      if (!motivo) return;
      const r = await ctx.almacen.cancelarApartado(ap.id, motivo);
      toast(r.ok ? 'Apartado cancelado' : 'No se pudo cancelar', { malo: !r.ok });
    }) }, 'Cancelar') : null,
    h('button', { class: 'btn', id: 'ap-abonar', onclick: () => ir(() => abrirPago(ctx, ap, 'abonar')) }, 'Abonar'),
    h('button', { class: 'btn primary', id: 'ap-completar', onclick: () => ir(() => abrirPago(ctx, ap, 'completar')) }, 'Completar')) : null;
  const v = abrirVentana({ titulo: ap.cliente?.nombre || 'Apartado', contenido, acciones, clase: 'ap-ventana', sinCabecera: true });
}

// Apartados: resumen de lo que falta por cobrar, búsqueda por cliente y filtros por estado.
registrarVista('/apartados', {
  montar(cont, ctx) {
    let filtro = 'pendiente', lista = [], busqueda = '';
    const FILTROS = [['pendiente', 'Pendientes'], ['completado', 'Completados'], ['cancelado', 'Cancelados'], ['todos', 'Todos']];
    const seg = h('div', { class: 'filtros filtro-ap', role: 'group', 'aria-label': 'Filtrar apartados' });
    const resumen = h('div', { class: 'ap-resumen' });
    const buscar = h('input', { class: 'inp', id: 'buscar-ap', type: 'search', 'aria-label': 'Buscar cliente o teléfono', placeholder: 'Buscar cliente o teléfono', autocomplete: 'off' });
    const caja = h('div', { class: 'lista-ap' });
    const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const pintar = () => {
      const pend = lista.filter(a => a.estado === 'pendiente');
      const porCobrar = pend.reduce((s, a) => s + a.saldo, 0);
      const viejos = pend.filter(a => diasDesde(a.fecha) >= 15).length;
      resumen.replaceChildren(
        h('div', { class: 'ap-res-cifra' }, h('span', { class: 'nota' }, 'Por cobrar'), h('b', { class: 'num' }, fmtCop(porCobrar))),
        h('div', { class: 'ap-res-sub' }, h('span', {}, h('b', { class: 'num' }, String(pend.length)), pend.length === 1 ? ' pendiente' : ' pendientes'),
          viejos ? h('span', { class: 'ap-res-viejos' }, icono('alerta'), h('b', { class: 'num' }, String(viejos)), ' con +15 días') : null));
      const cuenta = k => (k === 'todos' ? lista.length : lista.filter(a => a.estado === k).length);
      seg.replaceChildren(...FILTROS.map(([k, t]) => h('button', { type: 'button', class: 'chip' + (k === filtro ? ' activo' : ''), 'aria-pressed': String(k === filtro), onclick: () => { filtro = k; pintar(); } }, t, k === 'pendiente' && cuenta(k) ? h('span', { class: 'cuenta' }, String(cuenta(k))) : null)));
      const q = norm(busqueda);
      const vis = lista.filter(a => (filtro === 'todos' || a.estado === filtro) && (!q || norm(`${a.cliente?.nombre} ${a.cliente?.telefono}`).includes(q)))
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      caja.replaceChildren(...(vis.length ? vis.map(a => tarjeta(ctx, a)) : [h('div', { class: 'vacio' }, icono('apartado'), h('p', {}, busqueda ? 'Ningún apartado coincide' : lista.length ? (filtro === 'pendiente' ? 'No hay apartados pendientes' : 'No hay apartados aquí') : 'Todavía no hay apartados'),
        !lista.length ? h('p', { class: 'nota' }, 'Se crean desde el carrito con «Apartar»: las prendas quedan reservadas para el cliente.') : null)]));
    };
    buscar.addEventListener('input', () => { busqueda = buscar.value; pintar(); });
    const quitar = ctx.almacen.escuchar('apartados', l => { lista = l; pintar(); });
    cont.append(resumen, h('div', { class: 'ap-filtros' }, buscar, seg), caja);
    pintar();
    return quitar;
  },
});
