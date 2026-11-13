// Ventana Cobrar (§9.2): el cliente se registra antes, en su propia pantalla; pagos mixtos, vuelto, guardar la venta y recibo por WhatsApp.
import { h, icono, abrirVentana, toast } from '../ui.js';
import { conCaja } from './caja.js';
import { cobroAbierto, marcarCobro } from './cobro-abierto.js';
import { resumenCarrito, carrito, vaciarCarrito, revisarDescuento } from './vender.js';
import { crearPanelPagos } from './pagos.js';
import { comisionesVenta } from '../nucleo/comisiones.js';
import { repartirDescuento } from '../nucleo/descuento.js';
import { enlaceWhatsApp } from '../nucleo/recibo.js';
import { ventanaCliente, telefonoLegible } from './cliente.js';
import { fmtCop } from '../nucleo/dinero.js';

function nombreLinea(ctx, sku) {
  const p = ctx.productos[sku] || {};
  return [p.grupo || p.nombre || sku, p.talla && `Talla ${p.talla}`].filter(Boolean).join(' · ');
}

export function lineasParaGuardar(ctx, r) {
  const aj = ctx.ajustes;
  const coms = comisionesVenta(r.lineas, ctx.productos, aj.comisiones, r.descuento > 0);
  const descLinea = repartirDescuento(r.lineas, r.descuento);
  return r.lineas.map((l, i) => {
    const p = ctx.productos[l.sku];
    return { sku: l.sku, nombre: `${p.producto || p.nombre}${p.color ? ' ' + p.color : ''}`, talla: p.talla || '', cantidad: l.cantidad, tramo: l.tramo, precioUnit: l.precioUnit, subtotal: l.subtotal, oferta: l.oferta, descuento: descLinea[i], comision: coms[i].comision, reducida: coms[i].reducida };
  });
}

function confirmar(texto, si, no) {
  return new Promise(res => {
    const bSi = h('button', { class: 'btn primary' }, si), bNo = h('button', { class: 'btn' }, no);
    const v = abrirVentana({ titulo: 'Confirma', contenido: h('div', { class: 'aviso' }, icono('alerta'), texto), acciones: h('div', { class: 'acciones' }, bNo, bSi) });
    let r = false;
    bSi.onclick = () => { r = true; v.cerrar(); };
    bNo.onclick = () => v.cerrar();
    v.alCerrar = () => res(r);
  });
}

// Firma del carrito para detectar cambios (precios, tramos, ofertas, productos) mientras se cobra.
export const firmaCarrito = r => JSON.stringify([r.total, r.lineas.map(l => [l.sku, l.cantidad, l.precioUnit])]);

// Línea con el cliente del carrito y su botón Editar (dentro de Cobrar y Apartar).
export function resumenCliente(ctx) {
  const el = h('div', { class: 'cliente-resumen' });
  const pintar = () => {
    const c = ctx.carrito?.cliente || {};
    el.replaceChildren(icono('usuario'), h('div', { class: 'cli-datos' }, h('b', {}, c.nombre || '—'), h('span', { class: 'nota num' }, telefonoLegible(c.telefono))),
      h('button', { class: 'btn chico', id: 'cobro-cli-editar', onclick: () => ventanaCliente(ctx) }, icono('lapiz'), 'Editar'));
  };
  pintar();
  window.addEventListener('pos:carrito', pintar);
  return { el, quitar: () => window.removeEventListener('pos:carrito', pintar) };
}

export function abrirCobrar(ctx) {
  if (cobroAbierto()) return;
  revisarDescuento(ctx);
  const r0 = resumenCarrito(ctx);
  if (!r0.lineas.length) return;
  if (r0.total <= 0) { toast('El total debe ser mayor que 0', { malo: true }); return; }
  const idVenta = ctx.almacen.nuevoId();
  let guardando = false, hecha = false;
  const final = h('button', { class: 'btn primary grande', id: 'cobrar-final' }, `Cobrar ${fmtCop(r0.total)}`);
  const actualizar = () => { final.disabled = guardando || !panel.estado().cuadra; };
  const panel = crearPanelPagos(ctx, { total: r0.total, alCambiar: () => actualizar() });
  const cliente = resumenCliente(ctx);
  const cuerpo = h('div', { class: 'cobro' },
    cliente.el,
    h('div', { class: 'total-cobro' }, h('span', { class: 'total-cop num' }, fmtCop(r0.total)), h('span', { class: 'moneda c-cop' }, 'COP')),
    panel.el);
  const v = abrirVentana({ titulo: 'Cobrar', contenido: cuerpo, acciones: h('div', { class: 'pie-cobro' }, panel.barra, final), pantallaCompleta: true });
  v.alCerrar = () => cliente.quitar();
  marcarCobro(v);
  actualizar();

  final.addEventListener('click', async () => {
    if (guardando || hecha) return;
    guardando = true; actualizar();
    try {
      const r = resumenCarrito(ctx);
      if (firmaCarrito(r) !== firmaCarrito(r0)) { v.cerrar(); toast('Los precios cambiaron, revisa el cobro', { malo: true }); window.dispatchEvent(new CustomEvent('pos:carrito')); return; }
      const sinConexion = ctx.conexion && ctx.conexion.enLinea === false;
      if (sinConexion && r.lineas.some(l => (ctx.productos[l.sku]?.existencia ?? 0) - l.cantidad <= 2)) {
        const ok = await confirmar('Estás sin conexión y quedan pocas. Confirma con la tienda antes de cobrar.', 'Cobrar igual', 'Volver');
        if (!ok) return;
      }
      const { pagos, vuelto } = panel.resultado();
      const c = carrito(ctx);
      const venta = {
        id: idVenta, fecha: new Date().toISOString(),
        cliente: { ...carrito(ctx).cliente },
        lineas: lineasParaGuardar(ctx, r),
        subtotal: r.subtotal,
        descuento: r.descuento ? { tipo: c.descuento.tipo, valor: c.descuento.valor, monto: r.descuento, autorizadoPor: c.autorizacion?.por || null } : null,
        total: r.total, pagos, vuelto,
        tasas: { copPorUsd: ctx.tasas.copPorUsd, bsPorUsd: ctx.tasas.bsPorUsd, fuenteBs: ctx.tasas.fuenteBs },
      };
      const res = await conCaja(ctx, () => ctx.almacen.guardarVenta(venta));
      if (!res.ok) {
        if (res.faltantes) toast(`Ya no hay existencia de ${res.faltantes.map(s => nombreLinea(ctx, s)).join(', ')}`, { malo: true });
        else if (res.error === 'sin-caja') toast('Abre tu caja para vender', { malo: true });
        else toast('No se pudo guardar la venta', { malo: true });
        return;
      }
      hecha = true;
      ctx.almacen.guardarCliente(venta.cliente);
      const guardada = await ctx.almacen.obtener('ventas', idVenta) || venta;
      const enlace = enlaceWhatsApp(guardada, ctx.ajustes.tienda || { nombre: 'Comic Shop' }, ctx.ajustes.recibo);
      vaciarCarrito(ctx);
      window.dispatchEvent(new CustomEvent('pos:carrito'));
      toast('Venta guardada');
      v.el.querySelector('.cuerpo').replaceChildren(h('div', { class: 'listo' },
        h('div', { class: 'listo-ic' }, icono('check')),
        h('h2', {}, 'Venta guardada'),
        h('p', { class: 'num total-cop' }, fmtCop(venta.total), ' ', h('span', { class: 'moneda c-cop' }, 'COP')),
        res.offline ? h('p', { class: 'nota' }, 'Guardada en el teléfono. Se subirá al volver la conexión.') : null,
        vuelto ? h('p', { class: 'nota' }, 'Recuerda entregar el vuelto.') : null,
        enlace ? h('a', { class: 'btn grande recibo', href: enlace, target: '_blank', rel: 'noopener' }, icono('mensaje'), 'Enviar recibo por WhatsApp') : null,
        h('button', { class: 'btn primary grande', onclick: () => v.cerrar() }, 'Nueva venta')));
      v.el.querySelector('.pie')?.remove();
    } finally {
      guardando = false;
      if (!hecha) actualizar();
    }
  });
}
