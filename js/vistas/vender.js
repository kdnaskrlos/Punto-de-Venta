// Pantalla Vender (§8): tarjetas por modelo y color, tallas, carrito con tramos, descuento y atajos.
import { abrirEscaner, ICONO_ESCANER } from './escaner.js';
import { buscarCodigo } from './inventario.js';
import { h, icono, abrirVentana, abrirHoja, toast, esTelefono, hayCapas, largo, campoBusqueda, deslizarParaQuitar, alEnfocarCampo, teclearEn } from '../ui.js';
import { coincide, textoPreparado } from '../nucleo/busqueda.js';
import { abrirCajaVentana } from './caja.js';
import { registrarVista, navegar } from '../app.js';
import { titulo, grupoDe, textoBusqueda, fotoDe } from '../nucleo/producto.js';
import { tipoPrenda, compararTallas } from '../nucleo/tipo-prenda.js';
import { colorPrenda } from '../nucleo/colores.js';
import { calcularCarrito, etiquetaTramo } from '../nucleo/tramos.js';
import { aplicarDescuento, requiereAutorizacion } from '../nucleo/descuento.js';
import { fmtCop, fmtDec, parseMonto } from '../nucleo/dinero.js';
import { desdeCop } from '../nucleo/tasas.js';
import { ventanaCliente, telefonoLegible } from './cliente.js';


export function carrito(ctx) {
  ctx.carrito ||= { lineas: [], descuento: null, autorizacion: null };
  return ctx.carrito;
}

// Resumen del carrito: tramos, descuento y total.
export function resumenCarrito(ctx) {
  const c = carrito(ctx);
  const aj = ctx.ajustes;
  const calc = calcularCarrito(c.lineas, ctx.productos, { limites: aj.tramos, redondeo: aj.redondeo });
  // v2.09: el descuento solo se aplica a las prendas normales (las «separado» quedan fuera).
  const { descuento } = aplicarDescuento(calc.subtotalDescontable, c.descuento);
  const total = calc.subtotal - descuento;
  return { ...calc, descuento, total, unidades: calc.lineas.reduce((s, l) => s + l.cantidad, 0) };
}

// Un descuento deja de valer si el carrito cambió: el aprobado era para otro subtotal, y la vendedora
// no puede quedar por encima del máximo al quitar prendas. Devuelve false si lo quitó.
export function revisarDescuento(ctx) {
  const c = carrito(ctx);
  if (!c.descuento) return true;
  const sub = calcularCarrito(c.lineas, ctx.productos, { limites: ctx.ajustes.tramos, redondeo: ctx.ajustes.redondeo }).subtotalDescontable;
  const pct = c.descuento.tipo === 'pct' ? c.descuento.valor : (sub ? c.descuento.valor * 100 / sub : 100);
  const invalido = c.autorizacion ? c.autorizacion.subtotal !== sub
    : (requiereAutorizacion(ctx.rol(), pct, 0) || pct >= 100);
  if (!invalido) return true;
  c.descuento = null; c.autorizacion = null;
  if (c.lineas.length) toast('Se quitó el descuento: el carrito cambió');
  return false;
}

export function vaciarCarrito(ctx) { ctx.carrito = { lineas: [], descuento: null, autorizacion: null }; }

function enCarrito(ctx, sku) { return carrito(ctx).lineas.find(l => l.sku === sku)?.cantidad || 0; }

export function agregarAlCarrito(ctx, sku, delta = 1) {
  const c = carrito(ctx);
  const p = ctx.productos[sku];
  if (!p) return false;
  const actual = enCarrito(ctx, sku);
  const nueva = actual + delta;
  if (delta > 0 && nueva > p.existencia) { toast('No hay más existencia'); return false; }
  if (nueva <= 0) c.lineas = c.lineas.filter(l => l.sku !== sku);
  else if (actual) c.lineas.find(l => l.sku === sku).cantidad = nueva;
  else c.lineas.push({ sku, cantidad: nueva });
  revisarDescuento(ctx);
  window.dispatchEvent(new CustomEvent('pos:carrito'));
  return true;
}

function grupos(ctx) {
  const g = {};
  for (const p of Object.values(ctx.productos)) {
    if (p.activo === false) continue;
    const k = grupoDe(p);
    const t = (g[k] ||= { grupo: k, titulo: titulo(p), tipo: p.tipo, tela: p.tela, color: p.color, genero: p.genero, foto: null, variantes: [] });
    t.foto ||= fotoDe(p, ctx.imagenes); // la foto del código de imagen de la tarjeta
    t.variantes.push(p);
  }
  return Object.values(g).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es') || (a.color || '').localeCompare(b.color || '', 'es') || (a.tela || '').localeCompare(b.tela || '', 'es'));
}

// Línea del carrito en tarjeta: imagen, nombre, color y talla, tarifa; arriba a la derecha el contador
// (con una sola unidad, el − es un bote de basura) y abajo el monto.
// Con más de 2 prendas distintas las líneas se compactan (como en Pedidos): solo se abre la que se toca.
const MAX_ABIERTAS = 2;
const TODOS = 'Todos los productos';
function contador(ctx, l) {
  return h('div', { class: 'stepper lc-cont' },
    l.cantidad === 1
      ? h('button', { 'aria-label': 'Quitar', class: 'quitar', onclick: e => { e.stopPropagation(); quitarLinea(ctx, l.sku); } }, icono('borrar'))
      : h('button', { 'aria-label': 'Menos', onclick: e => { e.stopPropagation(); agregarAlCarrito(ctx, l.sku, -1); } }, icono('menos')),
    h('span', { class: 'cant num' }, String(l.cantidad)),
    h('button', { 'aria-label': 'Más', onclick: e => { e.stopPropagation(); agregarAlCarrito(ctx, l.sku, 1); } }, icono('mas1')));
}
// v2.11: círculo amarillo con cuántas prendas faltan para el próximo tramo (solo cuando faltan 3 o menos).
const circuloFalta = l => (l.faltan ? h('span', { class: 'lc-falta num', title: `Con ${l.faltan} más: precio ${l.siguiente}`, 'aria-label': `Faltan ${l.faltan} para precio ${l.siguiente}` }, String(l.faltan)) : null);
function lineaCarrito(ctx, l, aj, compacta) {
  const p = ctx.productos[l.sku];
  // v2.03: el género vuelve al nombre; debajo color y talla, sin la palabra «Talla» («Blanco · 6»).
  const g = { titulo: titulo(p), tipo: p.tipo, genero: p.genero, foto: fotoDe(p, ctx.imagenes) };
  const variante = [p.color, p.talla].filter(Boolean).join(' · ') || p.sku;
  const alternar = () => { const c = carrito(ctx); c.abierta = c.abierta === l.sku ? null : l.sku; window.dispatchEvent(new CustomEvent('pos:carrito')); };
  if (compacta) return h('div', { class: 'linea mini', 'data-sku': l.sku, role: 'button', tabindex: '0', 'aria-expanded': 'false', onclick: alternar, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } } },
    h('span', { class: 'lc-q num' }, String(l.cantidad)),
    // v2.05: color y talla en una segunda línea, debajo del nombre; el monto sobre la línea base de esa línea.
    h('span', { class: 'lc-t' }, h('b', {}, g.titulo), h('small', {}, variante, circuloFalta(l))),
    h('span', { class: 'lc-monto' }, h('span', { class: 'num monto' }, fmtCop(l.subtotal))),
    icono('abajo'));
  const plegable = carrito(ctx).lineas.length > MAX_ABIERTAS;
  return h('div', { class: 'linea' + (plegable ? ' abierta' : ''), 'data-sku': l.sku, onclick: plegable ? alternar : null, 'aria-expanded': plegable ? 'true' : null },
    miniatura(g, 'foto'),
    h('div', { class: 'linea-info' },
      h('b', {}, g.titulo),
      h('span', { class: 'lc-chip' }, variante),
      // v1.92: «Precio 1–5» (antes «Tarifa») y el precio por unidad al lado.
      h('span', { class: 'lc-precio' },
        // v1.99: el tramo en texto verde, sin pastilla (la oferta en ámbar).
                // v2.11: el círculo va pegado al tramo y «c/u» baja a su propia línea, debajo del tramo.
        h('span', { class: 'lc-tramo' + (l.oferta ? ' oferta' : '') }, l.oferta ? 'Precio de oferta' : `Precio ${etiquetaTramo(l.tramo, aj.tramos)}`),
        circuloFalta(l),
        l.cantidad > 1 ? h('span', { class: 'nota num lc-cu' }, `${fmtCop(l.precioUnit)} c/u`) : null)),
    h('div', { class: 'linea-der' },
      contador(ctx, l),
      h('span', { class: 'lc-pie' },
        h('span', { class: 'lc-monto' }, h('span', { class: 'num monto' }, fmtCop(l.subtotal)), h('span', { class: 'c-cop moneda' }, 'COP')))));
}

// Cambia el carrito con transiciones suaves (como en Pedidos): las líneas cambian de alto, las nuevas
// aparecen, y el aviso amarillo de tramos entra deslizándose.
const MENOS_MOV = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function ponerCarrito(cont, nuevo) {
  if (MENOS_MOV() || !cont.animate) { cont.replaceChildren(nuevo); return; }
  const antes = new Map([...cont.querySelectorAll('.linea[data-sku]')].map(el => [el.dataset.sku, { h: el.getBoundingClientRect().height, mini: el.classList.contains('mini') }]));
  const avisoViejo = cont.querySelector('.aviso-tramo');
  const avisoAntes = avisoViejo?.textContent || null;
  const rectViejo = avisoViejo?.getBoundingClientRect();
  const habia = antes.size > 0 || cont.querySelector('.carrito');
  const viejas = [...cont.querySelectorAll('.linea[data-sku]')];
  cont.replaceChildren(nuevo);
  if (!habia) return;
  // v1.98: la prenda que se quita no desaparece de golpe: su fantasma se desvanece y cierra el hueco,
  // así las de abajo suben suave en vez de saltar.
  const quedan = new Set([...cont.querySelectorAll('.linea[data-sku]')].map(el => el.dataset.sku));
  viejas.forEach((v, i) => {
    if (quedan.has(v.dataset.sku)) return;
    const sig = viejas.slice(i + 1).find(x => quedan.has(x.dataset.sku));
    const ancla = sig && cont.querySelector(`.linea[data-sku="${CSS.escape(sig.dataset.sku)}"]`);
    const ultima = [...cont.querySelectorAll('.linea[data-sku]')].pop();
    if (!ancla && !ultima) return;
    const h0 = antes.get(v.dataset.sku)?.h || v.offsetHeight;
    v.setAttribute('aria-hidden', 'true'); v.removeAttribute('data-sku');
    // v2.07: sin el alto mínimo de la tarjeta el hueco se cierra entero (antes se quedaba en 56–68 px y luego saltaba).
    v.style.pointerEvents = 'none'; v.style.overflow = 'hidden'; v.style.minHeight = '0px';
    if (ancla) ancla.before(v); else ultima.after(v);
    const g = parseFloat(getComputedStyle(v.parentElement).rowGap) || 0;
    // v2.06: si salió deslizándola, ya está fuera de la pantalla: solo se cierra su hueco (sin volver a aparecer).
    if (v.classList.contains('borrar')) {
      const tx = v.style.transform || 'translateX(-110%)';
      v.animate([{ height: `${h0}px`, opacity: 0, transform: tx, marginBottom: '0px' },
        { height: '0px', opacity: 0, transform: tx, paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', marginBottom: `-${g}px` }],
        { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => v.remove();
      return;
    }
    v.animate([{ height: `${h0}px`, opacity: 1, transform: 'none', marginBottom: '0px' },
      { height: `${h0}px`, opacity: 0, transform: 'translateX(-16px)', marginBottom: '0px', offset: .4 },
      { height: '0px', opacity: 0, transform: 'translateX(-16px)', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', marginBottom: `-${g}px` }],
      { duration: 260, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => v.remove();
  });
  cont.querySelectorAll('.linea[data-sku]').forEach(el => {
    const a = antes.get(el.dataset.sku), h1 = el.getBoundingClientRect().height, h0 = a ? a.h : 0;
    if (Math.abs(h1 - h0) < 2) return;
    el.style.overflow = 'hidden';
    const an = el.animate(a ? [{ height: `${h0}px` }, { height: `${h1}px` }] : [{ height: '0px', opacity: 0 }, { height: `${h1}px`, opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.22,.9,.3,1)' });
    if (!el.classList.contains('mini') && (!a || a.mini)) [...el.children].forEach((c, k) => c.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 170, delay: 40 + k * 35, easing: 'ease-out', fill: 'backwards' }));
    an.onfinish = an.oncancel = () => { el.style.overflow = ''; };
  });
  // Aviso amarillo de tramos (como el aviso de Pedidos): al aparecer, primero se abre su espacio y luego
  // se desvanece hacia adentro; al irse, lo inverso. El hueco del «gap» del carrito también se anima, sin saltos.
  const aviso = cont.querySelector('.aviso-tramo');
  const hueco = el => parseFloat(getComputedStyle(el.parentElement).rowGap) || 0;
  if (aviso && !avisoAntes) {
    const alto = aviso.getBoundingClientRect().height, g = hueco(aviso), cs = getComputedStyle(aviso);
    aviso.style.overflow = 'hidden';
    const an = aviso.animate([
      { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', marginTop: `-${g}px`, opacity: 0, transform: 'translateY(-8px)' },
      { height: `${alto}px`, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, borderTopWidth: cs.borderTopWidth, borderBottomWidth: cs.borderBottomWidth, marginTop: '0px', opacity: 0, transform: 'translateY(-8px)', offset: .45 },
      { height: `${alto}px`, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, borderTopWidth: cs.borderTopWidth, borderBottomWidth: cs.borderBottomWidth, marginTop: '0px', opacity: 1, transform: 'none' }],
      { duration: 340, easing: 'cubic-bezier(.4,0,.2,1)' });
    an.onfinish = () => { aviso.style.overflow = ''; moverIcono(aviso); };
    an.oncancel = () => { aviso.style.overflow = ''; };
  } else if (aviso && aviso.textContent !== avisoAntes) {
    // v2.03: el aviso ya no late ni brilla; solo el ícono se mueve una vez, y solo si cambió el tramo al
    // que se llega (no cuando solo cambia cuántas prendas faltan).
    const tramo = t => (String(t || '').match(/precio\s+(\S+)\s*$/i) || [])[1];
    if (tramo(aviso.textContent) !== tramo(avisoAntes)) moverIcono(aviso);
  } else if (!aviso && avisoViejo) {
    // Se fue: un fantasma del aviso queda en su lugar, se desvanece y cierra su espacio.
    const totales = cont.querySelector('.carrito > .totales');
    if (totales) {
      const fantasma = avisoViejo.cloneNode(true);
      fantasma.classList.remove('anim'); fantasma.setAttribute('aria-hidden', 'true');
      totales.before(fantasma);
      const g = hueco(fantasma), cs = getComputedStyle(fantasma);
      fantasma.style.overflow = 'hidden'; fantasma.style.pointerEvents = 'none';
      const lleno = { height: `${rectViejo.height}px`, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, borderTopWidth: cs.borderTopWidth, borderBottomWidth: cs.borderBottomWidth, marginTop: '0px' };
      fantasma.animate([
        { ...lleno, opacity: 1, transform: 'none' },
        { ...lleno, opacity: 0, transform: 'translateY(-8px)', offset: .4 },
        { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', marginTop: `-${g}px`, opacity: 0, transform: 'translateY(-8px)' }],
        { duration: 270, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => fantasma.remove();
    }
  }
}

// v2.03 · Deslizar una prenda del carrito hacia la izquierda para quitarla (igual que en Pedidos). v2.06: el gesto
// vive en ui.js (deslizarParaQuitar) y también lo usan las formas de pago del cobro.
// v2.08: quitar una prenda del carrito (papelera o deslizando) siempre ofrece «Deshacer».
function quitarLinea(ctx, sku) {
  const c = carrito(ctx), i = c.lineas.findIndex(l => l.sku === sku), linea = c.lineas[i];
  if (i < 0) return;
  c.lineas.splice(i, 1);
  window.dispatchEvent(new CustomEvent('pos:carrito'));
  toast('Prenda quitada', { deshacer: () => { const cc = carrito(ctx); cc.lineas.splice(Math.min(i, cc.lineas.length), 0, linea); window.dispatchEvent(new CustomEvent('pos:carrito')); } });
}
function gestoCarrito(ctx, cont) {
  deslizarParaQuitar(cont, '.linea[data-sku]', f => quitarLinea(ctx, f.dataset.sku));
}

function moverIcono(aviso) {
  const ic = aviso.querySelector('svg.i');
  if (!ic || MENOS_MOV() || !ic.animate) return;
  ic.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-14deg)', offset: .2 }, { transform: 'rotate(12deg)', offset: .45 }, { transform: 'rotate(-6deg)', offset: .7 }, { transform: 'rotate(0)' }], { duration: 700, easing: 'ease-in-out' });
}

export function equivalentes(ctx, cop) {
  // Redondeado hacia arriba, igual que lo que sugerirá Cobrar
  const usd = desdeCop(cop, 'USD', ctx.tasas, { haciaArriba: true }), bs = desdeCop(cop, 'BS', ctx.tasas, { haciaArriba: true });
  return h('div', { class: 'equivalentes num' },
    usd != null ? h('span', { class: 'c-usd' }, `${fmtDec(usd)} USD`) : null,
    usd != null && bs != null ? ' · ' : null,
    bs != null ? h('span', { class: 'c-bs' }, `${fmtDec(bs)} Bs`) : null);
}

export function panelCarrito(ctx, { enHoja = false } = {}) {
  const aj = ctx.ajustes;
  const r = resumenCarrito(ctx);
  const c = carrito(ctx);
  if (!r.lineas.length) return h('div', { class: 'carrito vacio-carrito' }, h('div', { class: 'sec-t' }, icono('carrito'), 'Carrito'), h('p', { class: 'nota' }, 'Toca una prenda para agregarla.'));
  return h('div', { class: 'carrito' + (enHoja ? ' en-hoja' : '') },
    enHoja ? null : h('div', { class: 'sec-t' }, icono('carrito'), `Carrito · ${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`),
    h('div', { class: 'lineas' + (r.lineas.length > MAX_ABIERTAS ? ' compactas' : '') }, r.lineas.map(l => lineaCarrito(ctx, l, aj, r.lineas.length > MAX_ABIERTAS && c.abierta !== l.sku))),
    // v2.10: sin avisos de «Con N prendas más pasan a precio …» (ni del mix ni de las «separado»).

    h('div', { class: 'totales' },
      r.descuento ? h('div', { class: 'fila-total' }, h('span', {}, 'Subtotal'), h('span', { class: 'num' }, fmtCop(r.subtotal), h('span', { class: 'c-cop moneda' }, 'COP'))) : null,
      // Sin descuento no hay fila: ya está el botón «Descuento» abajo.
      !r.descuento ? null : h('div', { class: 'fila-total desc' },
        h('span', { class: 'desc-et' }, icono('etiqueta'), 'Descuento'),
        h('span', { class: 'num desc-monto' }, '−' + fmtCop(r.descuento), h('span', { class: 'c-cop moneda' }, 'COP'))),
      h('div', { class: 'caja-total' },
        h('div', { class: 'et-total' }, 'Total'),
        h('div', { class: 'tc-der' },
          h('div', { class: 'total' }, h('span', { class: 'total-cop num', 'data-largo': largo(fmtCop(r.total)) }, fmtCop(r.total)), h('span', { class: 'c-cop moneda' }, 'COP')),
          h('div', { class: 'tc-eq' }, equivalentes(ctx, r.total))))),
    h('div', { class: 'acciones-carrito' },
      h('button', { class: 'btn primary cobrar', onclick: () => ctx.abrirCobro && ctx.abrirCobro('venta') }, 'Cobrar')));
}

// Barra de cobro (v1.97): total en COP con su equivalente en USD y Bs, Cobrar, y debajo Descuento y Apartar.
// En el teléfono va fija sobre la barra de íconos; en la computadora es la columna derecha.
function barraCobro(ctx, r) {
  // v2.06: la barra entera es el botón de cobrar («ticket»): cuántas prendas en un círculo, «Cobrar» y el total con
  // sus equivalentes a la derecha. Descuento y Apartar están en la pantalla de cobro.
  return h('div', { class: 'barra-cobro bcT', 'data-cobro': '' },
    h('button', { class: 'btn primary cobrar bt', type: 'button', 'aria-label': `Cobrar ${fmtCop(r.total)} COP, ${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`, onclick: () => ctx.abrirCobro && ctx.abrirCobro('venta') },
      // v2.10: sin texto; la cantidad va dentro de una camiseta blanca rellena.
      h('span', { class: 'bt-cnt' }, icono('franela'), h('b', { class: 'num', 'data-n': r.unidades > 99 ? '3' : null }, String(r.unidades))),
      h('span', { class: 'bt-total' },
        h('span', { class: 'total' }, h('span', { class: 'total-cop num', 'data-largo': largo(fmtCop(r.total)) }, fmtCop(r.total)), h('span', { class: 'moneda' }, 'COP')),
        equivalentes(ctx, r.total)),
      icono('der')));
}

// v2.15 · PC: el carrito como tabla (prenda, precio, cantidad, unidad y total) y, abajo, una barra fija con el
// cliente a la izquierda y el total con Cobrar a la derecha. En el teléfono sigue igual.
function tablaPC(ctx, r, alTodos) {
  const aj = ctx.ajustes;
  const filas = r.lineas.map(l => {
    const p = ctx.productos[l.sku];
    const g = { titulo: titulo(p), tipo: p.tipo, genero: p.genero, foto: fotoDe(p, ctx.imagenes) };
    return h('div', { class: 'linea fila-pc', 'data-sku': l.sku },
      h('span', { class: 'fp-prenda' }, miniatura(g, 'foto'), h('span', { class: 'fp-t' }, h('b', {}, g.titulo), h('small', {}, [p.color, p.talla].filter(Boolean).join(' · ') || p.sku))),
      h('span', { class: 'fp-tramo' }, h('span', { class: 'lc-tramo' + (l.oferta ? ' oferta' : '') }, l.oferta ? 'Oferta' : `Precio ${etiquetaTramo(l.tramo, aj.tramos)}`), circuloFalta(l)),
      h('span', { class: 'fp-cant' }, contador(ctx, l)),
      h('span', { class: 'fp-unit num' }, fmtCop(l.precioUnit)),
      h('span', { class: 'fp-total num' }, fmtCop(l.subtotal), h('small', { class: 'moneda c-cop' }, 'COP')),
      h('button', { type: 'button', class: 'ibtn fp-quitar', 'aria-label': 'Quitar prenda', onclick: e => { e.stopPropagation(); quitarLinea(ctx, l.sku); } }, icono('borrar')));
  });
  return h('div', { class: 'carrito tabla-pc' },
    h('div', { class: 'tp-cab', 'aria-hidden': 'true' }, h('span', {}, 'Prenda'), h('span', {}, 'Precio'), h('span', {}, 'Cantidad'), h('span', {}, 'Unidad'), h('span', {}, 'Total'), h('span', {})),
    filas.length ? h('div', { class: 'lineas' }, filas)
      : h('div', { class: 'tp-vacio' }, icono('carrito'), h('b', {}, 'Busca o escanea una prenda'), h('button', { type: 'button', class: 'btn', onclick: alTodos }, icono('cuadricula'), 'Todos los productos')));
}
function piePC(ctx, r) {
  const c = carrito(ctx).cliente;
  return h('div', { class: 'pie-pc', 'data-cobro': '' },
    h('div', { class: 'pc-cli' }, h('span', { class: 'pc-et' }, 'Cliente'),
      h('button', { type: 'button', class: 'pc-cli-btn' + (c ? ' con' : ''), id: 'pc-cliente', onclick: () => ventanaCliente(ctx) },
        icono('usuario'), c ? h('span', {}, h('b', {}, c.nombre), h('small', { class: 'num' }, telefonoLegible(c.telefono))) : h('span', {}, 'Agregar cliente'), h('kbd', {}, 'F1'))),
    h('div', { class: 'pc-tot' },
      // v2.17: el total de prendas grande, a la izquierda del total y separado por una línea (no en el botón).
      h('div', { class: 'pc-prendas-caja' + (r.unidades ? '' : ' cero'), 'aria-label': `${r.unidades} prendas` }, h('b', { class: 'num' }, String(r.unidades)), h('span', {}, r.unidades === 1 ? 'Prenda' : 'Prendas')),
      h('div', { class: 'pc-tot-num' },
        h('div', { class: 'total' }, h('span', { class: 'moneda c-cop' }, 'COP'), h('span', { class: 'total-cop num', 'data-largo': largo(fmtCop(r.total)) }, fmtCop(r.total))),
        r.unidades ? equivalentes(ctx, r.total) : h('div', { class: 'equivalentes' }, '0 prendas')),
      h('button', { type: 'button', class: 'btn primary cobrar pc-cobrar', disabled: !r.unidades, onclick: () => ctx.abrirCobro && ctx.abrirCobro('venta') },
        'Cobrar', h('kbd', {}, 'Enter'))));
}

// Descuento por monto, en pesos o en dólares (sin porcentaje). En dólares se convierte a pesos con la tasa del día.
// Si ya hay uno, la misma ventana permite quitarlo.
export function abrirDescuento(ctx) {
  const c = carrito(ctx);
  const r = resumenCarrito(ctx);
  // v2.09: las prendas «separado» no llevan descuento.
  if (!r.subtotalDescontable && !c.descuento) { toast('Estas prendas no llevan descuento'); return; }
  const aparte = r.lineas.filter(l => l.separado).reduce((s, l) => s + l.cantidad, 0);
  const max = 0; // la vendedora no da descuentos por su cuenta: todo descuento suyo necesita autorización
  const tasa = ctx.tasas?.copPorUsd || 0;
  let moneda = c.descuento?.moneda === 'USD' && tasa ? 'USD' : 'COP';
  const valor = h('input', { class: 'inp num', id: 'desc-valor', inputmode: 'decimal', autocomplete: 'off',
    value: c.descuento ? (moneda === 'USD' ? fmtDec(c.descuento.valorUsd) : fmtCop(c.descuento.valor)) : '' });
  const sufijo = h('span', { class: 'desc-moneda' });
  const equiv = h('p', { class: 'nota desc-equiv' });
  const err = h('span', { class: 'error' });
  const enPesos = () => { const n = parseMonto(valor.value, moneda); return n > 0 ? (moneda === 'USD' ? Math.round(n * tasa) : Math.round(n)) : 0; };
  const pintar = () => {
    sufijo.textContent = moneda; sufijo.className = 'desc-moneda ' + (moneda === 'USD' ? 'c-usd' : 'c-cop');
    const cop = enPesos();
    equiv.textContent = moneda === 'USD' && cop ? `= ${fmtCop(cop)} COP` : '';
  };
  const segm = h('div', { class: 'segmentado' },
    ...[['COP', 'Pesos (COP)'], ['USD', 'Dólares (USD)']].map(([m, txt]) => h('button', { type: 'button', 'data-moneda': m, 'aria-pressed': String(m === moneda), disabled: m === 'USD' && !tasa,
      onclick: e => { moneda = m; segm.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); valor.value = ''; err.textContent = ''; pintar(); } }, txt)));
  valor.addEventListener('input', pintar);
  const notaAparte = aparte ? h('p', { class: 'nota' }, `No aplica a ${aparte} ${aparte === 1 ? 'prenda que va' : 'prendas que van'} aparte; se descuenta de ${fmtCop(r.subtotalDescontable)} COP.`) : null;
  const nota = ctx.rol() === 'vendedora' ? h('p', { class: 'nota' }, 'El descuento se aplica cuando lo autorice el administrador o la encargada.') : null;
  const aplicar = h('button', { class: 'btn primary' }, 'Aplicar');
  const quitarDesc = c.descuento ? h('button', { type: 'button', class: 'btn texto peligro', id: 'desc-quitar', onclick: () => {
    // v2.08: con «Deshacer»: volver a ponerlo pediría otra autorización.
    const d = c.descuento, au = c.autorizacion;
    c.descuento = null; c.autorizacion = null; v.cerrar(); window.dispatchEvent(new CustomEvent('pos:carrito'));
    toast('Descuento quitado', { deshacer: () => { c.descuento = d; c.autorizacion = au; window.dispatchEvent(new CustomEvent('pos:carrito')); } });
  } }, 'Quitar descuento') : null;
  const v = abrirVentana({ titulo: 'Descuento', contenido: h('div', { class: 'pila' }, segm,
    h('div', { class: 'campo' }, h('label', { for: 'desc-valor' }, 'Monto a descontar'), h('div', { class: 'desc-entrada' }, valor, sufijo), equiv, err), notaAparte, nota),
    acciones: h('div', { class: 'acciones' }, quitarDesc, aplicar) });
  pintar();
  aplicar.addEventListener('click', async () => {
    const n = enPesos();
    if (!n) { err.textContent = 'Escribe un monto'; return; }
    const pct = r.subtotalDescontable ? n * 100 / r.subtotalDescontable : 100;
    if (pct >= 100) { err.textContent = aparte ? 'Debe ser menor que el total de las prendas con descuento' : 'Debe ser menor que el total'; return; }
    const tipo = 'monto';
    const desc = { tipo, valor: n, moneda, valorUsd: moneda === 'USD' ? parseMonto(valor.value, 'USD') : null };
    if (requiereAutorizacion(ctx.rol(), pct, max)) {
      aplicar.disabled = true;
      const s = await ctx.almacen.solicitarAutorizacion({ pct: Math.round(pct * 100) / 100, tipo, valor: n, subtotal: r.subtotalDescontable });
      if (!s.ok) { aplicar.disabled = false; err.textContent = s.error === 'red' ? 'Necesitas internet para pedir autorización' : 'No se pudo pedir'; return; }
      err.textContent = '';
      aplicar.textContent = 'Esperando autorización…';
      const quitar = ctx.almacen.escuchar('autorizaciones', lista => {
        const a = lista.find(x => x.id === s.id);
        if (!a || a.estado === 'pendiente') return;
        setTimeout(() => quitar && quitar());
        if (a.estado === 'aprobada') { c.descuento = desc; c.autorizacion = { id: a.id, por: a.aprueba, subtotal: r.subtotalDescontable }; v.cerrar(); toast('Descuento autorizado'); window.dispatchEvent(new CustomEvent('pos:carrito')); }
        else { aplicar.disabled = false; aplicar.textContent = 'Aplicar'; err.textContent = 'Descuento rechazado'; }
      });
      v.alCerrar = () => quitar && quitar();
      return;
    }
    c.descuento = desc; c.autorizacion = null;
    v.cerrar(); window.dispatchEvent(new CustomEvent('pos:carrito'));
  });
}

// Tallas: se eligen las cantidades con − y + (bien separados) y se pasan al carrito con «Agregar al carrito».
// Cerrar con la X no cambia el carrito.
function abrirTallas(ctx, g) {
  const variantes = [...g.variantes].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || compararTallas(a.talla, b.talla));
  const cuentas = Object.fromEntries(variantes.map(p => [p.sku, enCarrito(ctx, p.sku)]));
  const antes = { ...cuentas };
  const color = colorPrenda(g.color);
  const lista = h('div', { class: 'tallas-lista' });
  const agregar = h('button', { class: 'btn primary grande', id: 'tallas-agregar' });
  const pintar = () => {
    lista.replaceChildren(...variantes.map(p => {
      const n = cuentas[p.sku];
      const nombre = p.talla || 'Única'; // 39 variantes del inventario no tienen talla
      const agotada = p.existencia <= 0;
      const pocas = !agotada && p.existencia <= p.minimo;
      return h('div', { class: 'talla-fila-v' + (n ? ' con' : '') + (agotada ? ' agotada' : ''), 'data-sku': p.sku },
        h('span', { class: 'tf-talla' }, nombre),
        // v1.94: sin existencia dice «No hay» (más corto que «Agotada», para que quepa).
        h('span', { class: 'tf-disp' + (pocas ? ' pocas' : '') }, agotada ? 'No hay' : [`${p.existencia} `, h('span', { class: 'largo' }, p.existencia === 1 ? 'disponible' : 'disponibles'), h('span', { class: 'corto' }, 'disp.')]),
        h('span', { class: 'tf-paso' },
          h('button', { type: 'button', class: 'talla-menos', 'data-sku': p.sku, 'aria-label': `Quitar una talla ${nombre}`, disabled: !n,
            onclick: () => { cuentas[p.sku] = Math.max(0, n - 1); pintar(); } }, icono('menos')),
          h('input', { class: 'tf-cant num' + (n ? ' con' : ''), type: 'text', inputmode: 'numeric', enterkeyhint: 'done', autocomplete: 'off', value: String(n),
            'aria-label': `Cantidad talla ${nombre}`, disabled: agotada,
            onfocus: e => alEnfocarCampo(e.target),
            oninput: e => { const d = e.target.value.replace(/\D/g, ''); e.target.value = d; cuentas[p.sku] = Math.min(p.existencia, Number(d) || 0); resumen(); },
            onchange: () => pintar(),
            onkeydown: e => { if (e.key === 'Enter') e.target.blur(); } }),
          h('button', { type: 'button', class: 'talla-mas', 'data-talla': nombre, 'data-sku': p.sku, 'aria-label': `Agregar una talla ${nombre}`, disabled: agotada || n >= p.existencia,
            onclick: () => { if (n >= p.existencia) return; cuentas[p.sku] = n + 1; pintar(); } }, icono('mas1'))),
        !agotada && n > 0 && n >= p.existencia ? h('span', { class: 'tf-max' }, `Máximo ${p.existencia}`) : null);
    }));
    resumen();
  };
  const resumen = () => {
    const total = Object.values(cuentas).reduce((x, y) => x + y, 0);
    const cambio = variantes.some(p => cuentas[p.sku] !== antes[p.sku]);
    const habia = Object.values(antes).some(Boolean);
    agregar.replaceChildren(icono('carrito'), habia ? 'Actualizar carrito' : 'Agregar al carrito'); // v1.92: sin el contador de unidades
    agregar.disabled = !cambio;
  };
  pintar();
  const cont = h('div', { class: 'tallas-v' },
    g.color ? h('p', { class: 'tallas-sub' }, h('i', { class: 'punto-color grande', style: color ? `--pc:${color}` : '' }), g.color) : null, // v1.94: sin «Selecciona las tallas»
    lista);
  const v = abrirVentana({ titulo: g.titulo, contenido: cont, acciones: agregar, clase: 'ventana-tallas' });
  agregar.onclick = () => {
    for (const p of variantes) { const d = cuentas[p.sku] - enCarrito(ctx, p.sku); if (d) agregarAlCarrito(ctx, p.sku, d); }
    v.cerrar();
  };
}

// Tarjeta de prenda compacta: imagen cuadrada a la izquierda (foto o ícono gris según el tipo de prenda) y al lado nombre, tallas y precio.
export function miniatura(g, clase = 'miniatura') {
  return h('span', { class: clase }, g.foto ? h('img', { src: g.foto, alt: '', loading: 'lazy', width: 64, height: 64 }) : icono(tipoPrenda(g.tipo || g.titulo, g.genero)));
}

// Círculo con «−» arriba a la izquierda de la foto (v1.91): quita la prenda del carrito (todas sus tallas).
function insigniaCarrito(ctx, g, elegidas) {
  const quitar = e => {
    e.preventDefault(); e.stopPropagation();
    const skus = new Set(g.variantes.map(p => p.sku));
    for (const l of [...carrito(ctx).lineas].filter(x => skus.has(x.sku))) agregarAlCarrito(ctx, l.sku, -l.cantidad);
  };
  return h('span', { class: 'en-carrito quitar-sel', role: 'button', tabindex: '0', 'aria-label': `Quitar del carrito (${elegidas} ${elegidas === 1 ? 'prenda' : 'prendas'})`, onclick: quitar,
    onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') quitar(e); } }, icono('menos'));
}

// Tarjeta de prenda (Tarjetas listado): imagen cuadrada, nombre, color y tela; a la derecha disponibles y precio.
// La usan Vender (con el círculo del carrito) y el Inventario (v1.91), para que se vean exactamente igual.
// pocas: el Inventario pasa su propio criterio de stock bajo (alguna talla en el mínimo o agotada).
export function tarjetaPrenda(ctx, g, { alTocar, carrito: conCarrito = false, pocas: pocasDado } = {}) {
  const existencia = g.variantes.reduce((s, p) => s + Math.max(p.existencia, 0), 0);
  const agotada = existencia <= 0;
  const pocas = !agotada && (pocasDado ?? g.variantes.some(p => p.existencia > 0 && p.existencia <= p.minimo));
  const precio = Math.min(...g.variantes.map(p => p.precios?.[0] || Infinity));
  const oferta = g.variantes.some(p => p.oferta?.activa);
  const elegidas = conCarrito ? g.variantes.reduce((s, p) => s + enCarrito(ctx, p.sku), 0) : 0;
  const color = colorPrenda(g.color);
  return h('button', { type: 'button', class: 'tarjeta-prenda' + (agotada ? ' agotada' : '') + (elegidas ? ' elegida' : ''), 'data-grupo': g.grupo, 'data-nombre': [g.titulo, g.color].filter(Boolean).join(' '), onclick: alTocar },
    h('span', { class: 'tp-img' }, miniatura(g, 'foto'), elegidas ? insigniaCarrito(ctx, g, elegidas) : null),
    h('span', { class: 'info' },
      h('b', {}, g.titulo),
      h('span', { class: 'tp-linea' },
        g.color || g.tela ? h('span', { class: 'tp-color' }, g.color ? h('i', { class: 'punto-color', style: color ? `--pc:${color}` : '' }) : null, [g.color, g.tela].filter(Boolean).join(' · ')) : null)),
    h('span', { class: 'tp-der' },
      agotada ? h('span', { class: 'est r tp-estado' }, icono('alerta'), 'Agotada')
        : h('span', { class: 'est tp-disp ' + (pocas ? 'y' : 'g') }, `${existencia} disp.`),
      agotada ? null : h('span', { class: 'num precio' }, Number.isFinite(precio) ? fmtCop(precio) : '—'),
      !agotada && oferta ? h('span', { class: 'tp-estado tp-oferta' }, 'oferta') : null));
}
function tarjeta(ctx, g) {
  // v2.04: si la prenda tiene una sola talla se agrega directo (1 unidad por toque); con varias, la ventana de tallas.
  const tocar = () => {
    if (g.variantes.length !== 1) return abrirTallas(ctx, g);
    const p = g.variantes[0];
    if (p.existencia - enCarrito(ctx, p.sku) <= 0) { toast(enCarrito(ctx, p.sku) ? 'No hay más existencia' : 'No hay existencia'); return; }
    agregarAlCarrito(ctx, p.sku, 1);
  };
  return tarjetaPrenda(ctx, g, { carrito: true, alTocar: () => (ctx.miCaja || !ctx.puedeVer('cajaFisica') ? tocar() : abrirCajaVentana(ctx)) });
}

registrarVista('/vender', {
  montar(cont, ctx) {
    let busqueda = '', genero = '';
    const buscar = h('input', { class: 'inp', id: 'buscar', type: 'search', 'aria-label': 'Buscar prenda o código', placeholder: 'Buscar prenda o código', autocomplete: 'off', enterkeyhint: 'search' });
    const filtros = h('div', { class: 'filtros' });
    const rejilla = h('div', { class: 'rejilla' });
    // v1.97 · La pantalla de Vender es el carrito: sin la lista de prendas a la vista. Buscar o escanear agrega;
    // «Todos los productos» abre la lista completa (Tarjetas listado alargadas). Al agregar, se vuelve al carrito.
    // Total, Cobrar, Descuento y Apartar van en la barra de cobro: abajo en el teléfono, columna derecha en la computadora.
    const lado = h('aside', { class: 'lado-carrito barra-cobro-lado', hidden: true });
    const zonaCarrito = h('div', { class: 'zona-carrito' });
    const pie = h('div', { class: 'pie-pc-cont', hidden: true });
    gestoCarrito(ctx, zonaCarrito);
    const btnTodos = h('button', { class: 'btn btn-todos', type: 'button', id: 'todos-productos', onclick: () => { catalogo = true; buscar.value = TODOS; busqueda = ''; pintar(); } }, icono('cuadricula'), 'Todos los productos');
    const vacio = h('div', { class: 'venta-vacia' }, btnTodos);
    let catalogo = false, antes = new Map(), tLista = 0;
    const sinCaja = h('div', { class: 'aviso sin-caja' }, icono('cartera'), h('span', {}, 'Abre tu caja para vender'), h('span', { class: 'sp' }), h('button', { class: 'btn primary', onclick: () => abrirCajaVentana(ctx) }, 'Abrir caja'));

    // El mismo escáner del Inventario (cámara, foto del código o escribirlo / lector USB): lo leído se agrega al carrito.
    const escanear = h('button', { class: 'btn-escaner', type: 'button', id: 'escanear-vender', 'aria-label': 'Escanear código de barras',
      onclick: () => abrirEscaner({ tema: 'light', alLeer: cod => agregarPorCodigo(cod) }) });
    escanear.innerHTML = ICONO_ESCANER;

    function agregarPorCodigo(cod) {
      const [p] = buscarCodigo(Object.values(ctx.productos).filter(x => x.activo !== false), cod);
      if (!p) return false;
      if (agregarAlCarrito(ctx, p.sku, 1)) toast(`${titulo(p)} ${p.talla ? 'T' + p.talla : ''} agregada`);
      return true;
    }

    // v2.00 · Búsqueda sin lag: las tarjetas y su texto de búsqueda ya preparado se calculan una sola vez
    // (se rehacen solo si cambian los productos); se pintan primero 40 y el resto con «Mostrar más»;
    // y si se escribe rápido, solo se procesa la última letra de cada cuadro de pantalla.
    let cacheG = null, maxVis = 40, rafBusca = 0;
    const gruposListos = () => cacheG || (cacheG = grupos(ctx).map(g => Object.assign(g, { _txt: g.variantes.map(p => textoPreparado(p, textoBusqueda)) })));
    function pintar() {
      const todos = gruposListos();
      // Orden pedido: Unisex / Dama / Niño / Niña (otros géneros después, por nombre) y «Todo» al final.
      const ORDEN_GENERO = ['Unisex', 'Dama', 'Niño', 'Niña'];
      const pos = g => { const i = ORDEN_GENERO.indexOf(g); return i < 0 ? ORDEN_GENERO.length : i; };
      const generos = [...new Set(todos.map(g => g.genero).filter(Boolean))].sort((a, b) => pos(a) - pos(b) || a.localeCompare(b, 'es'));
      filtros.replaceChildren(...['', ...generos].map(c => h('button', { class: 'chip' + (c === genero ? ' activo' : ''), onclick: () => { genero = c; pintar(); } }, c || 'Todo')));
      // Búsqueda (v1.92): palabras en cualquier orden, sin tildes, plurales, tallas y códigos (nucleo/busqueda.js).
      const q = busqueda.trim();
      let vis = todos.filter(g => (!genero || g.genero === genero) && (!q || g._txt.some(t => coincide(t, q))));
      // v2.17 · PC: «Todos los productos» ordenado y separado por tipo, como el Inventario.
      const porTipo = new Map();
      if (!esTelefono()) {
        const tp = g => String(g.tipo || 'Otros');
        vis = [...vis].sort((a, b) => tp(a).localeCompare(tp(b), 'es'));
        for (const g of vis) porTipo.set(tp(g), (porTipo.get(tp(g)) || 0) + 1);
      }
      const conTipos = gs => { if (porTipo.size < 2) return gs.map(g => tarjeta(ctx, g)); let antes = null; return gs.flatMap(g => { const t = String(g.tipo || 'Otros'), c = t !== antes ? [h('h3', { class: 'inv-tipo' }, h('span', {}, t), h('small', { class: 'num' }, String(porTipo.get(t))))] : []; antes = t; return [...c, tarjeta(ctx, g)]; }); };
      const lista = !!q || catalogo;
      filtros.hidden = rejilla.hidden = !lista;
      // v1.98: al abrir la lista, chips y tarjetas entran con un fundido escalonado (solo esa vez, no en cada letra).
      if (lista && !cont.classList.contains('en-lista')) { cont.classList.add('lista-entra'); clearTimeout(tLista); tLista = setTimeout(() => cont.classList.remove('lista-entra'), 450); }
      cont.classList.toggle('en-lista', lista);
      const borrar = cont.querySelector('.buscar-borrar'); if (borrar && catalogo && !q) borrar.hidden = false; // la × también cierra «Todos los productos»
      const mas = vis.length > maxVis ? h('button', { type: 'button', class: 'btn mostrar-mas', onclick: () => { maxVis += 60; pintar(); } }, `Mostrar ${Math.min(60, vis.length - maxVis)} más`) : null;
      rejilla.replaceChildren(...(!lista ? [] : vis.length ? [...conTipos(vis.slice(0, maxVis)), ...(mas ? [mas] : [])] : [h('div', { class: 'vacio' }, q ? 'No hay prendas con esa búsqueda' : 'Todavía no hay productos. El administrador los importa desde la Carga Masiva.')]));
      pintarCarrito();
    }
    function pintarCarrito() {
      const porGrupo = new Map(gruposListos().map(g => [g.grupo, g]));
      rejilla.querySelectorAll('.tarjeta-prenda').forEach(el => { const g = porGrupo.get(el.dataset.grupo); if (g) el.replaceWith(tarjeta(ctx, g)); });
      const r = resumenCarrito(ctx);
      // ¿Qué prenda acaba de entrar o subir? Se resalta un momento y, si se estaba buscando, se vuelve al carrito.
      const ahora = new Map(carrito(ctx).lineas.map(l => [l.sku, l.cantidad]));
      const nueva = [...ahora].find(([sku, n]) => n > (antes.get(sku) || 0))?.[0];
      antes = ahora;
      if (nueva && (busqueda || catalogo)) { buscar.value = ''; busqueda = ''; catalogo = false; buscar.dispatchEvent(new Event('input', { bubbles: true })); return; }
      const lista = !!busqueda.trim() || catalogo;
      if (!esTelefono()) {
        // v2.15 · PC: tabla del carrito siempre a la vista (vacía, con «Todos los productos») y barra de cobro abajo.
        vacio.hidden = true; lado.hidden = true;
        zonaCarrito.hidden = lista; pie.hidden = lista;
        ponerCarrito(zonaCarrito, tablaPC(ctx, r, () => { catalogo = true; buscar.value = TODOS; busqueda = ''; pintar(); }));
        if (nueva) zonaCarrito.querySelector(`.linea[data-sku="${CSS.escape(nueva)}"]`)?.scrollIntoView({ block: 'nearest' });
        const totalAntes = pie.querySelector('.total-cop')?.textContent;
        pie.replaceChildren(piePC(ctx, r));
        const t = pie.querySelector('.total-cop');
        if (totalAntes && t && t.textContent !== totalAntes && !MENOS_MOV()) t.animate([{ transform: 'translateY(4px)', opacity: .35 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.22,.9,.3,1)' });
        cont.classList.add('pc');
        sinCaja.hidden = !!ctx.miCaja || !ctx.puedeVer('cajaFisica');
        return;
      }
      cont.classList.remove('pc'); pie.hidden = true;
      vacio.hidden = lista || !!r.unidades;
      zonaCarrito.hidden = lista || !r.unidades;
      if (r.unidades) ponerCarrito(zonaCarrito, panelCarrito(ctx, { enHoja: true })); else zonaCarrito.replaceChildren();
      // v2.07: sin resaltado verde al agregar o cambiar cantidades; solo se asegura que la prenda quede a la vista.
      if (nueva) zonaCarrito.querySelector(`.linea[data-sku="${CSS.escape(nueva)}"]`)?.scrollIntoView({ block: 'nearest' });
      // v1.98: la barra de cobro sube al aparecer (CSS) y baja antes de esconderse; el total late al cambiar.
      if (r.unidades) {
        const totalAntes = lado.querySelector('.total-cop')?.textContent;
        lado.getAnimations().forEach(a => { if (!(a instanceof CSSAnimation)) a.cancel(); }); lado.hidden = false;
        lado.replaceChildren(barraCobro(ctx, r));
        const t = lado.querySelector('.total-cop');
        if (totalAntes && t && t.textContent !== totalAntes && !MENOS_MOV()) t.animate([{ transform: 'translateY(4px)', opacity: .35 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.22,.9,.3,1)' });
      } else if (!lado.hidden && !MENOS_MOV() && lado.animate && getComputedStyle(lado).position === 'fixed') {
        lado.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(100%)', opacity: 0 }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).onfinish = () => { if (!resumenCarrito(ctx).unidades) lado.hidden = true; lado.getAnimations().forEach(x => { if (!(x instanceof CSSAnimation)) x.cancel(); }); };
      } else lado.hidden = true;
      cont.classList.toggle('con-barra', !!r.unidades);
      sinCaja.hidden = !!ctx.miCaja || !ctx.puedeVer('cajaFisica');
    }
    buscar.addEventListener('input', () => {
      // v2.06: con «Todos los productos» el buscador dice ese texto. La lista se quita solo al borrar la frase
      // completa (o con la ×); si se escribe algo después de la frase, se busca solo lo nuevo.
      if (catalogo && buscar.value !== TODOS) {
        const v = buscar.value;
        if (v.startsWith(TODOS)) { catalogo = false; buscar.value = v.slice(TODOS.length).trimStart(); }
        else if (v && !TODOS.startsWith(v)) catalogo = false; // se cambió por otra cosa: buscar eso
      }
      if (!buscar.value) catalogo = false;
      busqueda = catalogo ? '' : buscar.value;
      maxVis = 40; cancelAnimationFrame(rafBusca);
      if (!busqueda) pintar(); else rafBusca = requestAnimationFrame(pintar); // al borrar, de inmediato
    });
    buscar.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (agregarPorCodigo(buscar.value)) { buscar.value = ''; buscar.dispatchEvent(new Event('input', { bubbles: true })); }
      else buscar.blur();
    });
    const teclas = e => {
      if (e.key === 'F2') { e.preventDefault(); buscar.focus(); buscar.select(); }
      if (e.key === 'F1' && !esTelefono() && !hayCapas()) { e.preventDefault(); ventanaCliente(ctx); }
      // v2.17 · PC: Enter abre el cobro (no si se está escribiendo en un campo o sobre un botón: el lector USB termina con Enter en la búsqueda).
      const enCampo = e.target.closest?.('input, textarea, select, button, a, [contenteditable], [role=button]');
      if (((e.key === 'Enter' && !esTelefono() && !enCampo && !e.repeat) || e.key === 'F9') && carrito(ctx).lineas.length && !hayCapas()) { e.preventDefault(); ctx.abrirCobro && ctx.abrirCobro('venta'); }
    };
    const alDatos = e => { if (['productos', 'imagenes'].includes(e.detail.que)) cacheG = null; if (['productos', 'imagenes', 'ajustes', 'tasas', 'caja'].includes(e.detail.que)) pintar(); };
    document.addEventListener('keydown', teclas);
    window.addEventListener('pos:datos', alDatos);
    window.addEventListener('pos:carrito', pintarCarrito);

    cont.classList.add('vender');
    cont.append(h('div', { class: 'vender-main' }, sinCaja, h('div', { class: 'buscador' }, campoBusqueda(buscar), escanear, h('button', { class: 'btn btn-todos-pc', type: 'button', onclick: () => { catalogo = true; buscar.value = TODOS; busqueda = ''; pintar(); } }, icono('cuadricula'), 'Todos los productos')), filtros, rejilla, vacio, zonaCarrito, pie), lado);
    // v2.15: al pasar de teléfono a PC (o al revés) el carrito cambia de forma.
    const mq = matchMedia('(max-width:839px)'), alCambiarAncho = () => pintar();
    mq.addEventListener('change', alCambiarAncho);
    pintar();
    if (!esTelefono()) setTimeout(() => buscar.focus(), 50);
    const sinLector = teclearEn(buscar); // v2.15: lector USB en la PC
    return () => { sinLector(); mq.removeEventListener('change', alCambiarAncho); clearTimeout(tLista); document.removeEventListener('keydown', teclas); window.removeEventListener('pos:datos', alDatos); window.removeEventListener('pos:carrito', pintarCarrito); };
  },
});
