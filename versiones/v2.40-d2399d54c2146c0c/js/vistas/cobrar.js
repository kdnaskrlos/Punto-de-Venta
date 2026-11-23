import { nombreVenta } from '../nucleo/producto.js';
// Ventana Cobrar (§9.2): el cliente se registra antes, en su propia pantalla; pagos mixtos, vuelto, guardar la venta y recibo por WhatsApp.
import { h, icono, abrirVentana, toast, largo } from '../ui.js';
import { conCaja } from './caja.js';
import { cobroAbierto, marcarCobro } from './cobro-abierto.js';
import { resumenCarrito, carrito, vaciarCarrito, revisarDescuento, equivalentes, abrirDescuento } from './vender.js';
import { crearApartado } from './apartados.js';
import { crearPanelPagos } from './pagos.js';
import { verificarResguardoDescuento } from './autorizacion-descuento.js';
import { guardarVentaEnCurso } from './venta-en-curso.js';
import { anotarPendiente } from '../datos/pendientes.js';
import { comisionesVenta } from '../nucleo/comisiones.js';
import { repartirDescuento } from '../nucleo/descuento.js';
import { enlaceWhatsApp } from '../nucleo/recibo.js';
import { ventanaCliente, telefonoLegible } from './cliente.js';
import { fmtCop, fmtMonto } from '../nucleo/dinero.js';
import { NOMBRE_MONEDA } from '../nucleo/formas.js';

function nombreLinea(ctx, sku) {
  const p = ctx.productos[sku] || {};
  return [p.sku ? nombreVenta(p) : sku, p.talla && `Talla ${p.talla}`].filter(Boolean).join(' · ');
}

export function lineasParaGuardar(ctx, r) {
  const aj = ctx.ajustes;
  // v2.09: el descuento se reparte solo entre las prendas normales; las «separado» no lo llevan (ni la comisión reducida por él).
  const coms = comisionesVenta(r.lineas, ctx.productos, aj.comisiones, r.descuento > 0, aj.tramos);
  const descLinea = repartirDescuento(r.lineas.map(l => (l.separado ? { ...l, subtotal: 0 } : l)), r.descuento);
  return r.lineas.map((l, i) => {
    const p = ctx.productos[l.sku];
    return { sku: l.sku, nombre: nombreVenta(p), talla: p.talla || '', cantidad: l.cantidad, tramo: l.tramo, precioUnit: l.precioUnit, subtotal: l.subtotal, oferta: l.oferta, descuento: descLinea[i], comision: coms[i].comision, reducida: coms[i].reducida };
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
  let r0 = resumenCarrito(ctx);
  if (!r0.lineas.length) return;
  if (r0.total <= 0) { toast('El total debe ser mayor que 0', { malo: true }); return; }
  // v2.26 · Apagones: los ids van en el borrador del carrito ANTES de enviar. Si la luz se va a mitad del cobro,
  // al volver se revisa si esa venta ya existe (no se cobra dos veces) y, si no, se cobra con el mismo id.
  const c0 = carrito(ctx);
  c0.ventaId ||= ctx.almacen.nuevoId(); c0.apartadoId ||= ctx.almacen.nuevoId();
  guardarVentaEnCurso(ctx);
  const idVenta = c0.ventaId, idApartado = c0.apartadoId;
  let guardando = false, hecha = false;
  // v2.06: sin encabezado «Cobrar». Arriba, volver y el cliente; el total con su Descuento; abajo Apartar y Cobrar.
  const final = h('button', { class: 'btn primary grande', id: 'cobrar-final' });
  const abonoTxt = h('small', { hidden: true });
  const apartar = h('button', { class: 'btn grande cb-apartar', id: 'cobro-apartar', type: 'button' }, h('span', { class: 'cb-ap-t' }, icono('apartado'), 'Apartar'), abonoTxt);
  const actualizar = () => {
    const e = panel.estado();
    final.disabled = guardando || !e.cuadra || !e.vueltoValido;
    final.classList.toggle('cargando', guardando);
    final.textContent = guardando ? 'Cobrando…' : `Cobrar ${fmtCop(r0.total)}`;
    // Apartar: lo pagado queda como abono (puede ser 0); no se aparta si sobra (eso es una venta).
    const abono = Math.min(e.pagadoCop, r0.total);
    apartar.disabled = guardando || e.vueltoCop > 0 || e.cuadra || e.pagos.some(p => p.equivalenteCop == null);
    abonoTxt.hidden = !(abono > 0 && !e.cuadra); abonoTxt.textContent = `abono ${fmtCop(abono)}`;
  };
  const panel = crearPanelPagos(ctx, { total: r0.total, iniciales: c0.pagos, alCambiar: () => { actualizar(); if (!hecha) { carrito(ctx).pagos = panel.borrador(); guardarVentaEnCurso(ctx); } } });
  const cliente = resumenCliente(ctx);
  const totalBox = h('div', { class: 'total-cobro tarjeta cb-total' });
  const descBox = h('div', { class: 'cb-desc' });
  // v2.06: el descuento va fuera del recuadro verde, justo debajo del total.
  const pintarTotal = () => {
    totalBox.replaceChildren(
      h('div', { class: 'cb-fila' }, h('span', { class: 'et' }, 'Total a cobrar'),
        h('span', { class: 'tc-der' }, h('span', { class: 'total' }, h('span', { class: 'total-cop num', 'data-largo': largo(fmtCop(r0.total)) }, fmtCop(r0.total)), h('span', { class: 'moneda c-cop' }, 'COP')), equivalentes(ctx, r0.total))));
    descBox.replaceChildren(...[
      h('button', { type: 'button', class: 'cb-desc-btn', id: 'car-descuento', onclick: () => abrirDescuento(ctx) }, icono('etiqueta'), r0.descuento ? 'Cambiar descuento' : 'Agregar descuento'),
      r0.descuento ? h('span', { class: 'cb-desc-monto' }, h('span', { class: 'num' }, `−${fmtCop(r0.descuento)}`), h('span', { class: 'moneda' }, 'COP')) : null].filter(Boolean));
  };
  pintarTotal();
  // v2.06: sin flecha para volver (se vuelve con el botón atrás del teléfono o Esc).
  const cuerpo = h('div', { class: 'cobro cobro2' },
    cliente.el,
    totalBox, descBox,
    panel.el);
  const v = abrirVentana({ titulo: 'Cobrar', sinCabecera: true, contenido: cuerpo, acciones: h('div', { class: 'pie-cobro' }, panel.barra, h('div', { class: 'cb-botones' }, apartar, final)), pantallaCompleta: true });
  // Si cambia el descuento estando aquí, el total y lo que falta se recalculan sin perder los pagos.
  const alCarrito = () => {
    if (hecha || !v.el.isConnected) return;
    const r = resumenCarrito(ctx);
    if (!r.lineas.length) return;
    if (r.total !== r0.total || r.descuento !== r0.descuento) { r0 = r; panel.ponerTotal(r.total); pintarTotal(); actualizar(); }
  };
  window.addEventListener('pos:carrito', alCarrito);
  v.alCerrar = () => { cliente.quitar(); window.removeEventListener('pos:carrito', alCarrito); };
  marcarCobro(v);
  actualizar();

  apartar.addEventListener('click', async () => {
    if (guardando || hecha) return;
    guardando = true; actualizar();
    const ok = await crearApartado(ctx, { id: idApartado, r0, pagos: panel.resultado().pagos, cerrar: () => v.cerrar() });
    if (ok) hecha = true;
    guardando = false; if (!hecha) actualizar();
  });

  final.addEventListener('click', async () => {
    if (guardando || hecha || !verificarResguardoDescuento(ctx)) return;
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
      if (res.offline) anotarPendiente(ctx, { que: 'venta', id: idVenta, offline: true, datos: venta }); // v2.26: se revisa al reconectar
      ctx.almacen.guardarCliente(venta.cliente);
      const guardada = await ctx.almacen.obtener('ventas', idVenta) || venta;
      const enlace = enlaceWhatsApp(guardada, ctx.ajustes.tienda || { nombre: 'Comic Shop' }, ctx.ajustes.recibo);
      vaciarCarrito(ctx);
      window.dispatchEvent(new CustomEvent('pos:carrito'));
      v.el.querySelector('.cuerpo').replaceChildren(pantallaExito(ctx, venta, { enlace, offline: res.offline, cerrar: () => v.cerrar() }));
      v.el.querySelector('.pie')?.remove();
    } finally {
      guardando = false;
      if (!hecha) actualizar();
    }
  });
}

// Pantalla final: «Venta exitosa» con un check animado, el total en verde crema, cómo se pagó y el vuelto.
// Se cierra sola a los 10 s (barra que se vacía); tocar la pantalla detiene la cuenta.
const SEGUNDOS = 10;
function pantallaExito(ctx, venta, { enlace, offline, cerrar }) {
  const cliente = venta.cliente?.nombre;
  const hora = new Date(venta.fecha).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' }).replace(/\s?([ap])\.?\s?m\.?/i, ' $1m');
  const barra = h('i', {});
  const texto = h('span', {}, `Se cierra en ${SEGUNDOS} s`);
  const cuenta = h('div', { class: 'exito-cuenta', role: 'timer' }, h('span', { class: 'exito-barra' }, barra), texto);
  let resta = SEGUNDOS, reloj = null;
  const parar = () => { if (!reloj) return; clearInterval(reloj); reloj = null; cuenta.classList.add('parada'); texto.textContent = 'Cierre automático detenido'; barra.getAnimations?.().forEach(a => a.pause()); };
  const el = h('div', { class: 'listo exito', onpointerdown: e => { if (!e.target.closest('.btn')) parar(); } },
    h('div', { class: 'exito-ic' }, h('span', { class: 'exito-onda' }), icono('check')),
    h('h2', {}, 'Venta exitosa'),
    h('p', { class: 'nota exito-sub' }, [cliente, hora].filter(Boolean).join(' · ')),
    h('div', { class: 'exito-total' },
      h('span', { class: 'et' }, 'Total cobrado'),
      h('span', { class: 'total' }, h('span', { class: 'total-cop num', 'data-largo': largo(fmtCop(venta.total)) }, fmtCop(venta.total)), h('span', { class: 'moneda c-cop' }, 'COP')),
      equivalentes(ctx, venta.total)),
    venta.pagos?.length ? h('div', { class: 'exito-pagos' },
      ...venta.pagos.map(p => h('div', { class: 'exito-fila' }, h('span', {}, p.nombre), h('b', { class: 'num' }, `${fmtMonto(p.monto, p.moneda)} `, h('span', { class: 'moneda' }, NOMBRE_MONEDA[p.moneda])))),
      venta.vuelto ? h('div', { class: 'exito-fila vuelto' }, h('span', {}, 'Vuelto a entregar'),
        h('b', { class: 'num' }, venta.vuelto.partes
          ? (venta.vuelto.partes.map(p => `${fmtMonto(p.monto, p.moneda)} ${NOMBRE_MONEDA[p.moneda]}`).join(' + ') || '0 COP')
          : `${fmtMonto(venta.vuelto.monto, venta.vuelto.moneda)} ${NOMBRE_MONEDA[venta.vuelto.moneda]}`),
        venta.vuelto.remanenteCop ? h('small', { class: 'nota' }, `Ajuste por redondeo: ${fmtCop(venta.vuelto.remanenteCop)} COP`) : null) : null) : null,
    offline ? h('p', { class: 'nota' }, 'Guardada en el teléfono. Se subirá al volver la conexión.') : null,
    h('div', { class: 'exito-acc' },
      enlace ? h('a', { class: 'btn grande recibo', href: enlace, target: '_blank', rel: 'noopener', onclick: parar }, icono('mensaje'), 'Enviar recibo por WhatsApp') : null,
      h('button', { class: 'btn primary grande', onclick: cerrar }, 'Nueva venta')),
    cuenta);
  if (barra.animate) barra.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: SEGUNDOS * 1000, easing: 'linear', fill: 'forwards' });
  reloj = setInterval(() => {
    if (!el.isConnected) { clearInterval(reloj); return; }
    resta -= 1; texto.textContent = `Se cierra en ${resta} s`;
    if (resta <= 0) { clearInterval(reloj); reloj = null; cerrar(); }
  }, 1000);
  return el;
}
