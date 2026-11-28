// Apartados (§10): apartar desde el carrito, abonar, completar y cancelar.
import { anotarPendiente, LOCAL_PENDIENTE, RECHAZADA_CONFLICTO } from '../datos/pendientes.js';
import { abrirHojaStock } from './inventario.js';
import { h, icono, abrirVentana, toast, pedirMotivo, despuesDeCerrar, largo, campoBusqueda } from '../ui.js';
import { coincide } from '../nucleo/busqueda.js';
import { titulo } from '../nucleo/producto.js';
import { conCaja } from './caja.js';
import { cobroAbierto, marcarCobro } from './cobro-abierto.js';
import { registrarVista } from '../app.js';
import { verificarResguardoDescuento } from './autorizacion-descuento.js';
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
  v.alCerrar = () => { cliente.quitar(); panel.quitar(); };
  marcarCobro(v);
  actualizar();
  final.addEventListener('click', async () => {
    if (guardando) return;
    guardando = true; actualizar();
    const ok = await crearApartado(ctx, { id, r0, pagos: panel.resultado().pagos, cerrar: () => v.cerrar() });
    guardando = false;
    if (!ok) actualizar();
  });
}

// v2.06: guarda el apartado del carrito con los pagos como abono. Lo usan Apartar y la pantalla de cobro.
export async function crearApartado(ctx, { id, r0, pagos, cerrar }) {
  if (!verificarResguardoDescuento(ctx)) return false;
  const r = resumenCarrito(ctx);
  if (firmaCarrito(r) !== firmaCarrito(r0)) { cerrar(); toast('Los precios cambiaron, revisa el apartado', { malo: true }); return false; }
  const c = carrito(ctx);
  const ap = {
    id, fecha: new Date().toISOString(), cliente: { ...carrito(ctx).cliente }, lineas: lineasParaGuardar(ctx, r),
    subtotal: r.subtotal, descuento: r.descuento ? { tipo: c.descuento.tipo, valor: c.descuento.valor, monto: r.descuento, autorizadoPor: c.autorizacion?.por || null, autorizacionId: c.autorizacion?.id || null } : null,
    total: r.total, abonos: pagos, tasas: tasasDe(ctx),
  };
  const res = await conCaja(ctx, () => ctx.almacen.guardarApartado(ap));
  if (!res.ok) { toast(res.estadoSync === RECHAZADA_CONFLICTO ? 'Apartado en conflicto. Avisa a gestión.' : res.faltantes ? 'Ya no hay existencia de alguna prenda' : res.error === 'sin-caja' ? 'Abre tu caja para apartar' : 'No se pudo apartar', { malo: true }); return false; }
  if (res.offline && !res.estadoSync) anotarPendiente(ctx, { que: 'apartado', id, offline: true, datos: ap }); // v2.26
  ctx.almacen.guardarCliente(ap.cliente);
  vaciarCarrito(ctx); window.dispatchEvent(new CustomEvent('pos:carrito'));
  cerrar(); toast(res.estadoSync === LOCAL_PENDIENTE ? 'Apartado pendiente de sincronización' : 'Apartado creado');
  return true;
}

function abrirPago(ctx, ap, modo) {
  const completar = modo === 'completar';
  let guardando = false;
  const final = h('button', { class: 'btn primary grande', id: completar ? 'completar-final' : 'abono-final' }, completar ? `Cobrar saldo ${fmtCop(ap.saldo)}` : 'Registrar abono');
  const panel = crearPanelPagos(ctx, { total: ap.saldo, permitirMenos: !completar, alCambiar: () => actualizar() });
  const actualizar = () => {
    const e = panel.estado();
    final.disabled = guardando || (completar ? (!e.cuadra || !e.vueltoValido)
      : (e.pagadoCop <= 0 || e.vueltoCop > 0 || e.pagos.some(p => p.equivalenteCop == null)));
  };
  const v = abrirVentana({ titulo: completar ? 'Completar apartado' : 'Abonar', pantallaCompleta: true,
    contenido: h('div', { class: 'cobro' }, h('p', {}, h('b', {}, ap.cliente.nombre), ` · total ${fmtCop(ap.total)} · saldo `, h('b', { class: 'num' }, fmtCop(ap.saldo))), panel.el),
    acciones: h('div', { class: 'pie-cobro' }, panel.barra, final) });
  v.alCerrar = panel.quitar;
  actualizar();
  const idVenta = ctx.almacen.nuevoId();
  let pendiente = false;
  final.addEventListener('click', async () => {
    if (guardando) return;
    guardando = true; actualizar();
    const { pagos, vuelto } = panel.resultado();
    let res;
    if (completar) {
      const venta = {
        id: idVenta, fecha: new Date().toISOString(), cliente: ap.cliente, lineas: ap.lineas, subtotal: ap.subtotal, descuento: ap.descuento,
        total: ap.total, abonosPrevios: ap.total - ap.saldo, pagos, vuelto, tasas: tasasDe(ctx),
      };
      res = await conCaja(ctx, () => ctx.almacen.completarApartado(ap.id, venta));
      if (res.ok && res.offline && !res.estadoSync) anotarPendiente(ctx, { que: 'completar', id: idVenta, apartadoId: ap.id, offline: true, datos: venta }); // v2.26
    } else {
      const abono = { id: idVenta, pagos, fecha: new Date().toISOString(), tasas: tasasDe(ctx) };
      res = await conCaja(ctx, () => ctx.almacen.abonarApartado(ap.id, abono));
    }
    guardando = false;
    if (!res.ok) {
      toast(res.estadoSync === RECHAZADA_CONFLICTO ? 'Cobro en conflicto. Avisa a gestión antes de volver a cobrar.'
        : res.error === 'sin-caja' ? 'Abre tu caja primero'
        : res.error === 'excede' || res.error === 'saldo-cambio' ? 'El saldo cambió. Abre el apartado de nuevo.'
        : 'No se pudo guardar', { malo: true });
      actualizar();
      return;
    }
    pendiente ||= res.estadoSync === LOCAL_PENDIENTE;
    v.cerrar(); toast(pendiente ? 'Cobro pendiente de sincronización' : completar ? 'Venta guardada' : 'Abono guardado');
  });
}

// Días desde que se apartó (para notar los que llevan mucho tiempo).
const diasDesde = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
const telLegible = t => { const d = String(t || ''); return d.startsWith('58') && d.length === 12 ? `0${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : d; };

const fechaCorta = iso => fechaHora(iso).split(' · ')[0];

const diaCorto = iso => { const t = fechaHora(iso).split(' · ')[0].split(' '); return `${t[0].slice(0, 3)}. ${t[1]} ${t[2]}.`; };
// Tarjeta compacta: a la izquierda quién y qué; a la derecha cuánto falta y el estado.
function tarjeta(ctx, ap, filtro) {
  const [color, etiqueta] = ESTADO[ap.estado] || ESTADO.pendiente;
  const pendiente = ap.estado === 'pendiente';
  const dias = diasDesde(ap.fecha);
  const nombre = ap.cliente?.nombre || '—';
  const viejo = pendiente && dias >= 15;
  const abonado = ap.total - ap.saldo;
  return h('button', { type: 'button', class: `apartado ap-${ap.estado}${viejo ? ' viejo' : ''}`, 'data-id': ap.id, onclick: () => abrirDetalle(ctx, ap) },
    // Dos líneas: 1) nombre | «Abono» | «Saldo»; 2) fecha / «N días» (sin «Hace» desde la v1.92) | monto abonado | saldo.
    // Abono y saldo alineados a la derecha, con una línea divisoria continua entre ellos.
    h('b', { class: 'ap-nombre' }, nombre),
    h('span', { class: 'ap-et ap-et-abono' }, 'Abono'),
    h('span', { class: 'ap-et ap-et-saldo' }, pendiente ? 'Saldo' : ap.pendienteLocal ? 'Por sincronizar' : etiqueta),
    h('span', { class: 'ap-fecha' }, icono('calendario'), diaCorto(ap.fecha), h('span', { class: 'ap-sep', 'aria-hidden': 'true' }, '/'),
      h('span', { class: 'ap-hace' + (viejo ? ' viejo' : '') }, ap.pendienteLocal ? 'Por sincronizar' : dias <= 0 ? 'Hoy' : `${dias} ${dias === 1 ? 'día' : 'días'}`)),
    h('b', { class: 'num ap-abono' }, fmtCop(abonado)),
    h('b', { class: 'num ap-saldo' + (pendiente ? '' : ' cerrado') }, fmtCop(pendiente ? ap.saldo : ap.total)),
    h('span', { class: 'ap-linea', 'aria-hidden': 'true' }));
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
  const contenido = h('div', { class: 'ap-det det2' },
    h('div', { class: 'ap-det-cab' },
      h('div', {}, h('h2', { class: 'ap-det-nombre' }, ap.cliente?.nombre || 'Apartado'),
        // v2.00: el teléfono, más grande, abre el chat de WhatsApp del cliente.
        ap.cliente?.telefono ? h('a', { class: 'ap-det-tel nota num wa', href: `https://wa.me/${String(ap.cliente.telefono).replace(/\D/g, '')}`, target: '_blank', rel: 'noopener', 'aria-label': `Escribir por WhatsApp a ${ap.cliente?.nombre || 'cliente'}, ${telLegible(ap.cliente.telefono)}` }, icono('telefono'), telLegible(ap.cliente.telefono)) : null),
      h('span', { class: 'ap-det-cab-der' }, h('span', { class: `est ${color}` }, ap.pendienteLocal ? 'Por sincronizar' : etiqueta), h('button', { class: 'ibtn cerrar', 'data-act': 'close', 'aria-label': 'Cerrar' }, icono('x')))),
    h('div', { class: 'ap-det-pago' },
      h('div', { class: 'ap-det-cifras' },
        // Primero lo abonado y luego lo que falta (de izquierda a derecha, como se lee el pago).
        h('div', { class: 'ap-cif-abono' }, h('span', { class: 'nota' }, 'Total abonado'), h('b', { class: 'num' }, fmtCop(abonado)), h('small', {}, `de ${fmtCop(ap.total)}`)),
        h('div', { class: 'sep' }),
        h('div', { class: 'ap-cif-saldo' }, h('span', { class: 'nota' }, pendiente ? 'Saldo pendiente' : 'Total'), h('b', { class: 'num grande' + (pendiente ? ' rojo' : ''), 'data-largo': largo(fmtCop(pendiente ? ap.saldo : ap.total)) }, fmtCop(pendiente ? ap.saldo : ap.total)))),
      h('div', { class: 'ap-barra', role: 'progressbar', 'aria-label': 'Pagado', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: `width:${pct}%` }))),
    // v2.00: prendas y último abono como filas (cantidad en su cuadrito, nombre corto y «color · tela · talla»).
    h('div', { class: 'det-sec ap-sec-prendas' },
      h('h3', { class: 'det-t' }, icono('franela'), 'Prendas', h('span', { class: 'det-t-der' }, (() => { const n = ap.lineas.reduce((s, l) => s + (l.cantidad || 0), 0); return `${n} ${n === 1 ? 'prenda' : 'prendas'}`; })())),
      ...ap.lineas.map(l => {
        const p = ctx.productos?.[l.sku];
        const nombre = p ? titulo(p) : l.nombre;
        const det = [p?.color, p?.tela, l.talla && `Talla ${l.talla}`].filter(Boolean).join(' · ') || (l.talla ? `Talla ${l.talla}` : '');
        return h('div', { class: 'dfila con-q' }, h('span', { class: 'det-q num' }, String(l.cantidad)),
          h('span', { class: 'n' }, h('b', {}, nombre), det ? h('small', {}, det) : null),
          h('span', { class: 'v num' }, l.subtotal != null ? fmtCop(l.subtotal) : ''));
      })),
    ultimo ? h('div', { class: 'det-sec ap-sec-abono' },
      h('h3', { class: 'det-t' }, icono('cartera'), 'Último abono'),
      h('div', { class: 'dfila' }, h('span', { class: 'n' }, h('b', {}, ultimo.nombre || ultimo.forma), ultimo.fecha ? h('small', {}, diaCorto(ultimo.fecha).replace(/\.$/, '')) : null), h('span', { class: 'v num' }, textoAbono(ultimo))),
      abonos.length ? h('button', { type: 'button', class: 'det-ver', id: 'ap-historial', onclick: historial }, `Ver historial de abonos (${abonos.length})`, icono('der')) : null) : null,
    h('p', { class: 'det-meta' }, icono('calendario'), `Apartado el ${fechaHora(ap.fecha).replace(/^\S+ /, '')} · @${ap.usuario}`));
  const acciones = pendiente ? h('div', { class: 'acciones ap-acc' },
    !ap.pendienteLocal && ctx.puedeVer('cancelarApartado') ? h('button', { class: 'btn texto peligro', id: 'ap-cancelar', onclick: () => ir(async () => {
      const motivo = await pedirMotivo({ titulo: 'Cancelar apartado', boton: 'Cancelar apartado', peligro: true });
      if (!motivo) return;
      const r = await ctx.almacen.cancelarApartado(ap.id, motivo);
      toast(r.ok ? 'Apartado cancelado' : 'No se pudo cancelar', { malo: !r.ok });
    }) }, 'Cancelar') : null,
    h('button', { class: 'btn', id: 'ap-abonar', onclick: () => ir(() => abrirPago(ctx, ap, 'abonar')) }, 'Abonar'),
    h('button', { class: 'btn primary', id: 'ap-completar', onclick: () => ir(() => abrirPago(ctx, ap, 'completar')) }, 'Completar')) : null;
  // Hoja inferior, con la misma animación y gestos que el detalle del Inventario (arrastrar hacia abajo,
  // tocar el fondo, la X o Atrás).
  const v = abrirHojaStock({ tema: 'light', clase: 'hoja-pos ap-hoja', llenar: sh => {
    sh.setAttribute('aria-label', ap.cliente?.nombre || 'Apartado');
    sh.replaceChildren(h('div', { class: 'grab' }), contenido, ...(acciones ? [acciones] : []));
  } });
}

// Apartados: resumen de lo que falta por cobrar, búsqueda por cliente y filtros por estado.
// v1.98: la última lista vista se muestra al volver mientras llega la actual; la primera vez, tarjetas grises
// que respiran en lugar de «Todavía no hay apartados» por un instante.
let memoAp = null;

registrarVista('/apartados', {
  montar(cont, ctx) {
    let filtro = 'pendiente', busqueda = '';
    let lista = memoAp?.uid === ctx.sesion?.uid && memoAp?.almacen === ctx.almacen ? memoAp.lista : null;
    const FILTROS = [['pendiente', 'Pendientes'], ['completado', 'Completados'], ['cancelado', 'Cancelados'], ['todos', 'Todos']];
    const seg = h('div', { class: 'filtros filtro-ap', role: 'group', 'aria-label': 'Filtrar apartados' });
    const resumen = h('div', { class: 'ap-resumen' });
    const buscar = h('input', { class: 'inp', id: 'buscar-ap', type: 'search', 'aria-label': 'Buscar cliente, teléfono o prenda', placeholder: 'Buscar cliente, teléfono o prenda', autocomplete: 'off' });
    const caja = h('div', { class: 'lista-ap' });
    const pintar = () => {
      const cargando = !lista;
      if (cargando) {
        resumen.replaceChildren(h('div', { class: 'ap-res-cifra' }, h('span', { class: 'ap-res-et' }, h('span', { class: 'chip-ic' }, icono('monedas')), 'Por cobrar'), h('b', { class: 'num esqueleto', style: 'min-width:110px' }, '0')));
        seg.replaceChildren(...FILTROS.map(([k, t]) => h('button', { type: 'button', class: 'chip' + (k === filtro ? ' activo' : ''), 'aria-pressed': String(k === filtro), onclick: () => { filtro = k; pintar(); } }, t)));
        caja.replaceChildren(h('div', { class: 'ap-esqueleto', 'aria-busy': 'true' }), h('div', { class: 'ap-esqueleto' }), h('div', { class: 'ap-esqueleto' }));
        return;
      }
      const pend = lista.filter(a => a.estado === 'pendiente');
      const porCobrar = pend.reduce((s, a) => s + a.saldo, 0);
      const viejos = pend.filter(a => diasDesde(a.fecha) >= 15).length;
      resumen.replaceChildren(
        // v1.92: ícono antes de «Por cobrar»; estado «ícono · cantidad · por revisar» (apartados con 15 días o más).
        h('div', { class: 'ap-res-cifra' }, h('span', { class: 'ap-res-et' }, h('span', { class: 'chip-ic' }, icono('monedas')), 'Por cobrar'), h('b', { class: 'num' }, fmtCop(porCobrar))),
        h('div', { class: 'ap-res-sub' }, h('span', {}, h('b', { class: 'num' }, String(pend.length)), pend.length === 1 ? ' pendiente' : ' pendientes'),
          h('span', { class: 'ap-res-estado ' + (viejos ? 'revisar' : 'al-dia'), title: 'Apartados con 15 días o más' }, icono(viejos ? 'alerta' : 'check'), h('b', { class: 'num' }, String(viejos)), ' por revisar')));
      const cuenta = k => (k === 'todos' ? lista.length : lista.filter(a => a.estado === k).length);
      seg.replaceChildren(...FILTROS.map(([k, t]) => h('button', { type: 'button', class: 'chip' + (k === filtro ? ' activo' : ''), 'aria-pressed': String(k === filtro), onclick: () => { filtro = k; pintar(); } }, t, k === 'pendiente' && cuenta(k) ? h('span', { class: 'cuenta' }, String(cuenta(k))) : null)));
      // Búsqueda (v1.92): cliente, teléfono (con o sin 0 / +58, espacios o guiones) y prendas del apartado.
      const q = busqueda.trim();
      const vis = lista.filter(a => (filtro === 'todos' || a.estado === filtro) && (!q || coincide([a.cliente?.nombre, a.cliente?.telefono, ...(a.lineas || []).map(l => l.nombre)].filter(Boolean).join(' '), q)))
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      caja.replaceChildren(...(vis.length ? vis.map(a => tarjeta(ctx, a, filtro)) : [h('div', { class: 'vacio' }, icono('apartado'), h('p', {}, busqueda ? 'Ningún apartado coincide' : lista.length ? (filtro === 'pendiente' ? 'No hay apartados pendientes' : 'No hay apartados aquí') : 'Todavía no hay apartados'),
        !lista.length ? h('p', { class: 'nota' }, 'Se crean en la pantalla de cobro con «Apartar»: las prendas quedan reservadas para el cliente.') : null)]));
    };
    buscar.addEventListener('input', () => { busqueda = buscar.value; pintar(); });
    const quitar = ctx.almacen.escuchar('apartados', l => {
      const primera = !lista; lista = l; memoAp = { uid: ctx.sesion?.uid, almacen: ctx.almacen, lista: l }; pintar();
      if (primera) resumen.querySelector('.ap-res-cifra .num')?.classList.add('llega');
    }, { pendientesLocales: true });
    cont.append(resumen, h('div', { class: 'ap-filtros' }, campoBusqueda(buscar), seg), caja);
    pintar();
    return quitar;
  },
});
