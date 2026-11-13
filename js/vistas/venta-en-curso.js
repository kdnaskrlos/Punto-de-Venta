import { titulo } from '../nucleo/producto.js';
// Venta en curso: el carrito (prendas, descuento y cliente) se guarda en el aparato mientras se vende.
// Si la app se cierra o se sale sin querer, al volver pregunta "¿Continuar venta?" (igual que Pedidos).
import { h, icono, abrirVentana } from '../ui.js';
import { navegar } from '../app.js';

const VIGENCIA = 24 * 60 * 60 * 1000;
const clave = ctx => 'pos-venta-' + (ctx.sesion?.usuario || '');

function guardar(ctx) {
  if (!ctx.sesion) return;
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

export function vigilarVentaEnCurso(ctx) {
  const g = () => guardar(ctx);
  window.addEventListener('pos:carrito', g);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') g(); });
  window.addEventListener('pagehide', g);
}

export function ofrecerRetomar(ctx) {
  const d = leer(ctx);
  if (!d || ctx.carrito?.lineas?.length) return;
  const c = d.c;
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
  cancelar.onclick = () => { try { localStorage.removeItem(clave(ctx)); } catch { /* */ } v.cerrar(); };
  continuar.onclick = () => {
    const existe = sku => !ctx.productos || !Object.keys(ctx.productos).length || ctx.productos[sku];
    ctx.carrito = { lineas: c.lineas.filter(l => existe(l.sku)), descuento: c.descuento || null, autorizacion: c.autorizacion || null, ...(c.cliente ? { cliente: c.cliente } : {}) };
    v.cerrar();
    window.dispatchEvent(new CustomEvent('pos:carrito'));
    if (location.hash !== '#/vender') navegar('/vender');
  };
}
