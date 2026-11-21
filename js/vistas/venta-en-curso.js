import { titulo } from '../nucleo/producto.js';
// Venta en curso: el carrito (prendas, descuento y cliente) se guarda en el aparato mientras se vende.
// Si la app se cierra o se sale sin querer, al volver pregunta "¿Continuar venta?" (igual que Pedidos).
import { h, icono, abrirVentana, despuesDeCerrar } from '../ui.js';
import { navegar } from '../app.js';

const VIGENCIA = 24 * 60 * 60 * 1000;
const clave = ctx => ctx.ambitoPrueba ? ctx.ambitoPrueba + ':carrito' : 'pos-venta-' + (ctx.sesion?.usuario || '');

export function guardarVentaEnCurso(ctx) { guardar(ctx); }

function guardar(ctx) {
  if (!ctx.sesion || !ctx.carrito) return;
  const c = ctx.carrito;
  try {
    if (c?.lineas?.length) localStorage.setItem(clave(ctx), JSON.stringify({ c, en: Date.now() }));
    else localStorage.removeItem(clave(ctx));
  } catch { /* sin almacenamiento */ }
}

function leer(ctx) {
  try {
    const d = JSON.parse(localStorage.getItem(clave(ctx)) || 'null');
    return d?.c?.lineas?.length && Date.now() - d.en < VIGENCIA ? d : null;
  } catch { return null; }
}

export function vigilarVentaEnCurso(contexto) {
  const g = () => guardar(contexto());
  window.addEventListener('pos:carrito', g);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') g(); });
  window.addEventListener('pagehide', g);
}

export async function ofrecerRetomar(ctx, activo = () => true) {
  const d = leer(ctx);
  if (!d || ctx.carrito?.lineas?.length) return;
  const c = d.c;
  // v2.26 · Si la luz se fue justo al cobrar, la venta (o el apartado) pudo quedar guardada: no se ofrece cobrarla otra vez.
  const almacen = ctx.almacen;
  let ya = c.ventaId && await almacen.obtener('ventas', c.ventaId) ? 'venta' : null;
  if (!activo()) return;
  if (!ya && c.apartadoId && await almacen.obtener('apartados', c.apartadoId)) ya = 'apartado';
  if (!activo()) return;
  if (ya) {
    try { localStorage.removeItem(clave(ctx)); } catch { /* */ }
    const ok = h('button', { class: 'btn primary', id: 'ya-guardada' }, 'Entendido');
    const v = abrirVentana({ titulo: ya === 'venta' ? 'La venta ya se guardó' : 'El apartado ya se guardó', contenido: h('p', { class: 'nota' },
      `${ya === 'venta' ? 'La venta' : 'El apartado'}${c.cliente?.nombre ? ' de ' + c.cliente.nombre : ''} que estaba en curso sí quedó guardado antes del corte. No hay que cobrarlo otra vez.`),
      acciones: h('div', { class: 'acciones' }, ok) });
    ok.onclick = () => v.cerrar();
    return;
  }
  if (ctx.carrito?.lineas?.length) return;
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
  cancelar.onclick = () => {
    if (!activo()) return;
    try { localStorage.removeItem(clave(ctx)); } catch { /* */ }
    v.cerrar();
  };
  continuar.onclick = () => {
    if (!activo()) return;
    const existe = sku => !ctx.productos || !Object.keys(ctx.productos).length || ctx.productos[sku];
    ctx.carrito = { lineas: c.lineas.filter(l => existe(l.sku)), descuento: c.descuento || null, autorizacion: c.autorizacion || null, ...(c.cliente ? { cliente: c.cliente } : {}),
      ...(c.ventaId ? { ventaId: c.ventaId, apartadoId: c.apartadoId } : {}), ...(c.pagos?.length ? { pagos: c.pagos } : {}) }; // v2.26: mismos ids y pagos escritos
    v.cerrar();
    window.dispatchEvent(new CustomEvent('pos:carrito'));
    // v2.13: se va al carrito cuando la ventana termina de cerrarse (antes el «atrás» del cierre deshacía el cambio de pantalla).
    despuesDeCerrar(() => { if (activo() && location.hash !== '#/vender') navegar('/vender'); });
  };
}
