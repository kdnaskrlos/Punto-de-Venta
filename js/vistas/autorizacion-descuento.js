import { calcularCarrito } from '../nucleo/tramos.js';
import { toast } from '../ui.js';
import { actualizarResguardo, guardarVentaEnCurso, resguardoVigente } from './venta-en-curso.js';

const emitir = () => window.dispatchEvent(new CustomEvent('pos:carrito'));
const prendas = c => JSON.stringify([c.ventaId, c.lineas.map(l => [l.sku, l.cantidad])]);
const firma = (c, calculo) => JSON.stringify([
  prendas(c), calculo.lineas.map(l => [l.sku, l.cantidad, l.precioUnit, l.separado]),
]);
const propia = (sesion, s) => sesion?.uid === s.uid && sesion?.usuario === s.usuario;

function calcular(ctx, c) {
  return calcularCarrito(c.lineas, ctx.productos || {}, { limites: ctx.ajustes.tramos, redondeo: ctx.ajustes.redondeo });
}

export function invalidarSolicitudDescuento(ctx) {
  const c = ctx.carrito;
  const s = c?.solicitudDescuento;
  const a = c?.autorizacion;
  if ((!s || s.estado === 'invalidada') && !a?.firma) return false;
  const lineas = prendas(c);
  // Durante la restauración puede llegar primero el borrador y después el catálogo.
  const conCatalogo = ctx.preciosListos;
  const actual = conCatalogo ? firma(c, calcular(ctx, c)) : null;
  const invalida = v => !propia(ctx.sesion, v) || !c.lineas.length || v.prendas !== lineas || (conCatalogo && v.firma !== actual);
  const solicitudCambio = s && s.estado !== 'invalidada' && invalida(s);
  const descuentoCambio = a?.firma && invalida(a);
  if (!solicitudCambio && !descuentoCambio) return false;
  if (solicitudCambio) s.estado = 'invalidada';
  if (descuentoCambio || (solicitudCambio && a?.id === s.id)) {
    c.descuento = null;
    c.autorizacion = null;
  }
  if (c.lineas.length) toast(descuentoCambio
    ? 'Se quitó el descuento: el carrito cambió' : 'El carrito cambió. Vuelve a pedir autorización.');
  return true;
}

export function verificarResguardoDescuento(ctx) {
  if (!ctx.carrito?.solicitudDescuento || resguardoVigente(ctx)) return true;
  toast('Retoma esta venta en la pestaña que tiene el borrador', { malo: true });
  return false;
}

export async function solicitarDescuento(ctx, c, calculo, descuento, pct) {
  const { almacen, sesion } = ctx;
  if (!sesion || ctx.carrito !== c || c.solicitudDescuento?.estado === 'pendiente') return { ok: false, error: 'estado' };
  c.ventaId ||= almacen.nuevoId();
  const huella = firma(c, calculo);
  if (huella !== firma(c, calcular(ctx, c))) return { ok: false, error: 'carrito' };
  const s = {
    id: almacen.nuevoId(), uid: sesion.uid, usuario: sesion.usuario, ventaId: c.ventaId,
    firma: huella, prendas: prendas(c), subtotal: calculo.subtotalDescontable, descuento, estado: 'pendiente',
  };
  const anterior = c.solicitudDescuento;
  c.solicitudDescuento = s;
  // El navegador puede recargarse mientras la escritura todavía está en curso.
  if (!guardarVentaEnCurso(ctx)) {
    if (anterior) c.solicitudDescuento = anterior; else delete c.solicitudDescuento;
    return { ok: false, error: 'borrador' };
  }
  emitir();
  const r = await almacen.solicitarAutorizacion({
    ventaId: s.ventaId, firmaCarrito: s.firma, subtotal: s.subtotal,
    tipo: descuento.tipo, valor: descuento.valor, pct: Math.round(pct * 100) / 100,
  }, s.id).catch(() => ({ ok: false, error: 'error' }));
  if (!r.ok && s.estado === 'pendiente' && c.solicitudDescuento === s) {
    s.estado = 'error';
    if (ctx.carrito === c && ctx.almacen === almacen && propia(ctx.sesion, s)) emitir();
    else actualizarResguardo(c);
  }
  return r;
}

export function vigilarAutorizacionDescuento(ctx) {
  let activa = null;
  const detener = () => { const previa = activa; activa = null; previa?.quitar(); };
  const revisar = (desdeDatos = false) => {
    const c = ctx.carrito, s = c?.solicitudDescuento;
    if (invalidarSolicitudDescuento(ctx) && desdeDatos) emitir();
    if (activa && (activa.c !== c || activa.s !== s || !ctx.preciosListos || s?.estado !== 'pendiente')) detener();
    if (activa || !ctx.preciosListos || s?.estado !== 'pendiente' || !propia(ctx.sesion, s)) return;
    const almacen = ctx.almacen;
    const escucha = { c, s, quitar: () => {} };
    activa = escucha;
    const quitar = almacen.escuchar('autorizaciones', lista => {
      if (activa !== escucha || ctx.almacen !== almacen || ctx.carrito !== c || c.solicitudDescuento !== s ||
          !propia(ctx.sesion, s) || !resguardoVigente(ctx)) return;
      const a = lista.find(x => x.id === s.id && propia(x, s) && x.ventaId === s.ventaId &&
        x.firmaCarrito === s.firma && x.subtotal === s.subtotal && x.tipo === s.descuento.tipo && x.valor === s.descuento.valor);
      if (!a || !['aprobada', 'rechazada'].includes(a.estado)) return;
      if (invalidarSolicitudDescuento(ctx)) { emitir(); return; }
      detener();
      s.estado = a.estado;
      if (a.estado === 'aprobada') {
        c.descuento = s.descuento;
        c.autorizacion = {
          id: s.id, por: a.aprueba, subtotal: s.subtotal,
          uid: s.uid, usuario: s.usuario, firma: s.firma, prendas: s.prendas,
        };
      }
      emitir();
      toast(a.estado === 'aprobada' ? 'Descuento autorizado' : 'Descuento rechazado', { malo: a.estado === 'rechazada' });
    });
    if (activa === escucha) escucha.quitar = quitar;
    else quitar();
  };
  window.addEventListener('pos:carrito', () => revisar());
  window.addEventListener('pos:carrito-vaciado', detener);
  window.addEventListener('pos:datos', e => {
    if (['productos', 'ajustes'].includes(e.detail.que)) revisar(true);
  });
  return detener;
}
