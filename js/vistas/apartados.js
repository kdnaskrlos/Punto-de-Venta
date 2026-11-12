// Apartados (§10): apartar desde el carrito, abonar, completar y cancelar.
import { h, icono, abrirVentana, toast, pedirMotivo, unaVez } from '../ui.js';
import { conCaja } from './caja.js';
import { cobroAbierto, marcarCobro } from './cobro-abierto.js';
import { registrarVista } from '../app.js';
import { resumenCarrito, carrito, vaciarCarrito, revisarDescuento } from './vender.js';
import { crearPanelPagos } from './pagos.js';
import { camposCliente, lineasParaGuardar, firmaCarrito } from './cobrar.js';
import { fmtCop } from '../nucleo/dinero.js';
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
    final.disabled = guardando || !cliente.valido() || e.vueltoCop > 0 || e.pagos.some(p => p.equivalenteCop == null);
  };
  const cliente = camposCliente(ctx, () => actualizar());
  const panel = crearPanelPagos(ctx, { total: r0.total, permitirMenos: true, alCambiar: () => actualizar() });
  const v = abrirVentana({ titulo: 'Apartar', pantallaCompleta: true,
    contenido: h('div', { class: 'cobro' }, cliente.el, h('div', { class: 'total-cobro' }, h('span', { class: 'total-cop num' }, fmtCop(r0.total)), h('span', { class: 'moneda c-cop' }, 'COP')), h('p', { class: 'nota' }, 'El abono es opcional. Las prendas quedan reservadas.'), panel.el),
    acciones: h('div', { class: 'pie-cobro' }, panel.barra, final) });
  v.alCerrar = () => cliente.quitar();
  marcarCobro(v);
  actualizar();
  setTimeout(() => cliente.foco(), 40);
  final.addEventListener('click', async () => {
    if (guardando) return;
    guardando = true; actualizar();
    const r = resumenCarrito(ctx);
    if (firmaCarrito(r) !== firmaCarrito(r0)) { guardando = false; v.cerrar(); toast('Los precios cambiaron, revisa el apartado', { malo: true }); return; }
    const c = carrito(ctx);
    const { pagos } = panel.resultado();
    const ap = {
      id, fecha: new Date().toISOString(), cliente: cliente.datos(), lineas: lineasParaGuardar(ctx, r),
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

function tarjeta(ctx, ap) {
  const [color, etiqueta] = ESTADO[ap.estado] || ESTADO.pendiente;
  const prendas = ap.lineas.reduce((s, l) => s + l.cantidad, 0);
  const pendiente = ap.estado === 'pendiente';
  return h('article', { class: 'apartado tarjeta', 'data-id': ap.id },
    h('div', { class: 'ap-cab' }, h('b', {}, ap.cliente?.nombre || '—'), h('span', { class: `est ${color}` }, etiqueta)),
    h('div', { class: 'nota' }, `${fechaHora(ap.fecha)} · ${prendas} ${prendas === 1 ? 'prenda' : 'prendas'} · por @${ap.usuario}`),
    h('div', { class: 'ap-lineas' }, ap.lineas.map(l => h('div', { class: 'nota' }, `${l.cantidad} × ${l.nombre}${l.talla ? ' · Talla ' + l.talla : ''}`))),
    h('div', { class: 'ap-montos num' }, h('span', {}, `Total ${fmtCop(ap.total)}`), h('span', {}, `Abonado ${fmtCop(ap.total - ap.saldo)}`), pendiente ? h('b', {}, `Saldo ${fmtCop(ap.saldo)}`) : null),
    pendiente ? h('div', { class: 'acciones' },
      ctx.puedeVer('cancelarApartado') ? h('button', { class: 'btn danger', onclick: e => unaVez(e.currentTarget, async () => {
        const motivo = await pedirMotivo({ titulo: 'Cancelar apartado', boton: 'Cancelar apartado', peligro: true });
        if (!motivo) return;
        const r = await ctx.almacen.cancelarApartado(ap.id, motivo);
        toast(r.ok ? 'Apartado cancelado' : 'No se pudo cancelar', { malo: !r.ok });
      })() }, 'Cancelar') : null,
      h('button', { class: 'btn', onclick: () => abrirPago(ctx, ap, 'abonar') }, 'Abonar'),
      h('button', { class: 'btn primary', onclick: () => abrirPago(ctx, ap, 'completar') }, 'Completar')) : null);
}

registrarVista('/apartados', {
  montar(cont, ctx) {
    let filtro = 'pendiente', lista = [];
    const seg = h('div', { class: 'segmentado filtro-ap' });
    const caja = h('div', { class: 'lista-ap' });
    const pintar = () => {
      seg.replaceChildren(...[['pendiente', 'Pendientes'], ['todos', 'Todos']].map(([k, t]) => h('button', { 'aria-pressed': String(k === filtro), onclick: () => { filtro = k; pintar(); } }, t)));
      const vis = lista.filter(a => filtro === 'todos' || a.estado === 'pendiente').sort((a, b) => b.fecha.localeCompare(a.fecha));
      caja.replaceChildren(...(vis.length ? vis.map(a => tarjeta(ctx, a)) : [h('div', { class: 'vacio' }, h('p', {}, filtro === 'pendiente' ? 'No hay apartados pendientes' : 'Todavía no hay apartados'), h('p', { class: 'nota' }, 'Se crean desde el carrito con «Apartar»: las prendas quedan reservadas para el cliente.'))]));
    };
    const quitar = ctx.almacen.escuchar('apartados', l => { lista = l; pintar(); });
    cont.append(h('div', { class: 'cab-vista' }, h('h1', { class: 'sec-t' }, icono('apartado'), 'Apartados'), seg), caja);
    pintar();
    return quitar;
  },
});
