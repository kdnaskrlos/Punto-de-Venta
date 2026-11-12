// Ventana Cobrar (§9.2): cliente obligatorio, pagos mixtos, vuelto, guardar la venta y recibo por WhatsApp.
import { h, icono, abrirVentana, toast } from '../ui.js';
import { cobroAbierto, marcarCobro } from './cobro-abierto.js';
import { resumenCarrito, carrito, vaciarCarrito, revisarDescuento } from './vender.js';
import { crearPanelPagos } from './pagos.js';
import { comisionesVenta } from '../nucleo/comisiones.js';
import { repartirDescuento } from '../nucleo/descuento.js';
import { telefonoInternacional, enlaceWhatsApp } from '../nucleo/recibo.js';
import { fmtCop } from '../nucleo/dinero.js';

// Campos de cliente (teléfono primero; si ya existe, completa el nombre).
export function camposCliente(ctx, alCambiar) {
  let clientes = [];
  const quitar = ctx.almacen.escuchar('clientes', l => { clientes = l; });
  const tel = h('input', { class: 'inp', id: 'cli-tel', type: 'tel', inputmode: 'tel', autocomplete: 'off', placeholder: '0412 123 4567' });
  const nombre = h('input', { class: 'inp', id: 'cli-nombre', autocomplete: 'off', autocapitalize: 'words' });
  const errTel = h('span', { class: 'error' }), errNom = h('span', { class: 'error' });
  tel.addEventListener('input', () => {
    const t = telefonoInternacional(tel.value);
    const c = t && clientes.find(x => x.telefono === t);
    if (c && !nombre.value.trim()) nombre.value = c.nombre;
    errTel.textContent = '';
    alCambiar();
  });
  tel.addEventListener('blur', () => { if (tel.value.trim() && !telefonoInternacional(tel.value)) errTel.textContent = 'Teléfono no válido'; });
  nombre.addEventListener('input', () => { errNom.textContent = ''; alCambiar(); });
  const el = h('div', { class: 'cliente' },
    h('div', { class: 'campo' }, h('label', { for: 'cli-tel' }, 'Teléfono del cliente'), tel, errTel),
    h('div', { class: 'campo' }, h('label', { for: 'cli-nombre' }, 'Nombre'), nombre, errNom));
  return {
    el, quitar,
    valido: () => !!telefonoInternacional(tel.value) && nombre.value.trim().length >= 2,
    datos: () => ({ nombre: nombre.value.trim(), telefono: telefonoInternacional(tel.value) }),
    foco: () => tel.focus(),
  };
}

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

export function abrirCobrar(ctx) {
  if (cobroAbierto()) return;
  revisarDescuento(ctx);
  const r0 = resumenCarrito(ctx);
  if (!r0.lineas.length) return;
  if (r0.total <= 0) { toast('El total debe ser mayor que 0', { malo: true }); return; }
  const idVenta = ctx.almacen.nuevoId();
  let guardando = false, hecha = false;
  const final = h('button', { class: 'btn primary grande', id: 'cobrar-final' }, `Cobrar ${fmtCop(r0.total)}`);
  const actualizar = () => { final.disabled = guardando || !cliente.valido() || !panel.estado().cuadra; };
  const cliente = camposCliente(ctx, () => actualizar());
  const panel = crearPanelPagos(ctx, { total: r0.total, alCambiar: () => actualizar() });
  const cuerpo = h('div', { class: 'cobro' },
    cliente.el,
    h('div', { class: 'total-cobro' }, h('span', { class: 'total-cop num' }, fmtCop(r0.total)), h('span', { class: 'moneda c-cop' }, 'COP')),
    panel.el);
  const v = abrirVentana({ titulo: 'Cobrar', contenido: cuerpo, acciones: h('div', { class: 'pie-cobro' }, panel.barra, final), pantallaCompleta: true });
  v.alCerrar = () => cliente.quitar();
  marcarCobro(v);
  actualizar();
  setTimeout(() => cliente.foco(), 40);

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
        cliente: cliente.datos(),
        lineas: lineasParaGuardar(ctx, r),
        subtotal: r.subtotal,
        descuento: r.descuento ? { tipo: c.descuento.tipo, valor: c.descuento.valor, monto: r.descuento, autorizadoPor: c.autorizacion?.por || null } : null,
        total: r.total, pagos, vuelto,
        tasas: { copPorUsd: ctx.tasas.copPorUsd, bsPorUsd: ctx.tasas.bsPorUsd, fuenteBs: ctx.tasas.fuenteBs },
      };
      const res = await ctx.almacen.guardarVenta(venta);
      if (!res.ok) {
        if (res.faltantes) toast(`Ya no hay existencia de ${res.faltantes.map(s => nombreLinea(ctx, s)).join(', ')}`, { malo: true });
        else if (res.error === 'sin-caja') toast('Abre tu caja para vender', { malo: true });
        else toast('No se pudo guardar la venta', { malo: true });
        return;
      }
      hecha = true;
      ctx.almacen.guardarCliente(venta.cliente);
      const guardada = await ctx.almacen.obtener('ventas', idVenta) || venta;
      const enlace = enlaceWhatsApp(guardada, ctx.ajustes.tienda || { nombre: 'Comic Shop' });
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
