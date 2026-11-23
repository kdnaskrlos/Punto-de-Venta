import { titulo } from '../nucleo/producto.js';
// Venta en curso: el carrito (prendas, descuento y cliente) se guarda en el aparato mientras se vende.
// Si la app se cierra o se sale sin querer, al volver pregunta "¿Continuar venta?" (igual que Pedidos).
import { h, icono, abrirVentana, despuesDeCerrar } from '../ui.js';
import { navegar } from '../app.js';

const VIGENCIA = 24 * 60 * 60 * 1000;
const clave = ctx => 'pos-venta-' + (ctx.sesion?.usuario || '');
const resguardos = new WeakMap();

function vigente(original) {
  try {
    const d = JSON.parse(original);
    return d?.c?.lineas?.length && Date.now() - d.en < VIGENCIA ? d : null;
  } catch { return null; }
}

function coincide(ctx, guardado) {
  try {
    return guardado && ctx.sesion && guardado.clave === clave(ctx) &&
      localStorage.getItem(guardado.clave) === guardado.original;
  } catch { return false; }
}

function descartar(ctx, guardado) {
  try {
    if (coincide(ctx, guardado)) localStorage.removeItem(guardado.clave);
  } catch { /* sin almacenamiento */ }
}

export function resguardoVigente(ctx) {
  return coincide(ctx, resguardos.get(ctx.carrito));
}

function escribir(c, k, anterior) {
  const original = JSON.stringify({ c, en: Math.max(Date.now(), (vigente(anterior)?.en || 0) + 1) });
  localStorage.setItem(k, original);
  resguardos.set(c, { clave: k, original });
}

export function actualizarResguardo(c) {
  const previo = resguardos.get(c);
  try {
    if (previo && localStorage.getItem(previo.clave) === previo.original) escribir(c, previo.clave, previo.original);
  } catch { /* sin almacenamiento */ }
}

export function guardarVentaEnCurso(ctx) {
  const c = ctx.carrito;
  if (!ctx.sesion || !c) return false;
  const previo = resguardos.get(c);
  if (!c.lineas?.length) {
    descartar(ctx, previo);
    resguardos.delete(c);
    return false;
  }
  try {
    const k = clave(ctx);
    const original = localStorage.getItem(k);
    const otro = vigente(original);
    const propio = previo?.clave === k && previo.original === original;
    // Un carrito local sin el resguardo actual no reemplaza el de otra pestaña.
    if (!propio && (otro || previo?.clave === k)) return false;
    escribir(c, k, original);
    return true;
  } catch { return false; }
}

function leer(ctx) {
  try {
    const k = clave(ctx);
    const original = localStorage.getItem(k);
    const d = vigente(original);
    return d && { clave: k, original, c: d.c };
  } catch { return null; }
}

export function vigilarVentaEnCurso(ctx) {
  window.addEventListener('pos:carrito', () => guardarVentaEnCurso(ctx));
  window.addEventListener('pos:carrito-vaciado', e => {
    descartar(ctx, resguardos.get(e.detail));
    resguardos.delete(e.detail);
  });
  const guardarAlSalir = () => { if (ctx.carrito?.lineas?.length) guardarVentaEnCurso(ctx); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarAlSalir(); });
  window.addEventListener('pagehide', guardarAlSalir);
}

export async function ofrecerRetomar(ctx) {
  const d = leer(ctx);
  if (!d || ctx.carrito?.lineas?.length) return;
  const c = d.c;
  // v2.26 · Si la luz se fue justo al cobrar, la venta (o el apartado) pudo quedar guardada: no se ofrece cobrarla otra vez.
  const ya = (c.ventaId && await ctx.almacen.obtener('ventas', c.ventaId)) ? 'venta' : (c.apartadoId && await ctx.almacen.obtener('apartados', c.apartadoId)) ? 'apartado' : null;
  if (!coincide(ctx, d) || ctx.carrito?.lineas?.length) return;
  if (ya) {
    descartar(ctx, d);
    const ok = h('button', { class: 'btn primary', id: 'ya-guardada' }, 'Entendido');
    const v = abrirVentana({ titulo: ya === 'venta' ? 'La venta ya se guardó' : 'El apartado ya se guardó', contenido: h('p', { class: 'nota' },
      `${ya === 'venta' ? 'La venta' : 'El apartado'}${c.cliente?.nombre ? ' de ' + c.cliente.nombre : ''} que estaba en curso sí quedó guardado antes del corte. No hay que cobrarlo otra vez.`),
      acciones: h('div', { class: 'acciones' }, ok) });
    ok.onclick = () => v.cerrar();
    return;
  }
  const prendas = c.lineas.reduce((s, l) => s + l.cantidad, 0);
  const nombres = [...new Set(c.lineas.map(l => (ctx.productos?.[l.sku] ? titulo(ctx.productos[l.sku]) : l.sku)))];
  const continuar = h('button', { class: 'btn primary', id: 'retomar-si' }, icono('check'), 'Continuar');
  const cancelar = h('button', { class: 'btn', id: 'retomar-no' }, 'Cancelar');
  const v = abrirVentana({ titulo: '¿Continuar venta?', contenido: h('div', { class: 'pila' },
    h('p', { class: 'nota' }, 'Quedó una venta sin terminar en este aparato.'),
    h('div', { class: 'venta-curso' }, h('span', { class: 'chip-ic' }, icono('carrito')),
      h('div', {}, h('b', {}, c.cliente?.nombre || 'Sin cliente todavía'),
        h('small', {}, `${prendas} ${prendas === 1 ? 'prenda' : 'prendas'} · ${nombres.slice(0, 2).join(', ')}${nombres.length > 2 ? '…' : ''}`)))),
    acciones: h('div', { class: 'acciones' }, cancelar, continuar) });
  cancelar.onclick = () => { descartar(ctx, d); v.cerrar(); };
  continuar.onclick = () => {
    if (!coincide(ctx, d) || ctx.carrito?.lineas?.length) { v.cerrar(); return; }
    const existe = sku => !ctx.productos || !Object.keys(ctx.productos).length || ctx.productos[sku];
    ctx.carrito = { lineas: c.lineas.filter(l => existe(l.sku)), descuento: c.descuento || null, autorizacion: c.autorizacion || null, ...(c.cliente ? { cliente: c.cliente } : {}),
      ...(c.solicitudDescuento ? { solicitudDescuento: c.solicitudDescuento } : {}),
      ...(c.ventaId ? { ventaId: c.ventaId } : {}), ...(c.apartadoId ? { apartadoId: c.apartadoId } : {}),
      ...(c.pagos?.length ? { pagos: c.pagos } : {}) }; // v2.26: mismos ids y pagos escritos
    resguardos.set(ctx.carrito, d);
    v.cerrar();
    window.dispatchEvent(new CustomEvent('pos:carrito'));
    // v2.13: se va al carrito cuando la ventana termina de cerrarse (antes el «atrás» del cierre deshacía el cambio de pantalla).
    despuesDeCerrar(() => { if (location.hash !== '#/vender') navegar('/vender'); });
  };
}
