// Pantalla Vender (§8): tarjetas por modelo y color, tallas, carrito con tramos, descuento y atajos.
import { h, icono, abrirVentana, abrirHoja, toast, esTelefono, hayCapas, largo } from '../ui.js';
import { abrirCajaVentana } from './caja.js';
import { registrarVista, navegar } from '../app.js';
import { titulo, grupoDe, textoBusqueda, fotoDe } from '../nucleo/producto.js';
import { tipoPrenda, compararTallas } from '../nucleo/tipo-prenda.js';
import { colorPrenda } from '../nucleo/colores.js';
import { calcularCarrito, etiquetaTramo } from '../nucleo/tramos.js';
import { aplicarDescuento, requiereAutorizacion } from '../nucleo/descuento.js';
import { fmtCop, fmtDec, parseMonto } from '../nucleo/dinero.js';
import { desdeCop } from '../nucleo/tasas.js';

const norm = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function carrito(ctx) {
  ctx.carrito ||= { lineas: [], descuento: null, autorizacion: null };
  return ctx.carrito;
}

// Resumen del carrito: tramos, descuento y total.
export function resumenCarrito(ctx) {
  const c = carrito(ctx);
  const aj = ctx.ajustes;
  const calc = calcularCarrito(c.lineas, ctx.productos, { limites: aj.tramos, redondeo: aj.redondeo });
  const { descuento, total } = aplicarDescuento(calc.subtotal, c.descuento);
  return { ...calc, descuento, total, unidades: calc.lineas.reduce((s, l) => s + l.cantidad, 0) };
}

// Un descuento deja de valer si el carrito cambió: el aprobado era para otro subtotal, y la vendedora
// no puede quedar por encima del máximo al quitar prendas. Devuelve false si lo quitó.
export function revisarDescuento(ctx) {
  const c = carrito(ctx);
  if (!c.descuento) return true;
  const sub = calcularCarrito(c.lineas, ctx.productos, { limites: ctx.ajustes.tramos, redondeo: ctx.ajustes.redondeo }).subtotal;
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
function contador(ctx, l) {
  return h('div', { class: 'stepper lc-cont' },
    l.cantidad === 1
      ? h('button', { 'aria-label': 'Quitar', class: 'quitar', onclick: e => { e.stopPropagation(); agregarAlCarrito(ctx, l.sku, -1); } }, icono('borrar'))
      : h('button', { 'aria-label': 'Menos', onclick: e => { e.stopPropagation(); agregarAlCarrito(ctx, l.sku, -1); } }, icono('menos')),
    h('span', { class: 'cant num' }, String(l.cantidad)),
    h('button', { 'aria-label': 'Más', onclick: e => { e.stopPropagation(); agregarAlCarrito(ctx, l.sku, 1); } }, icono('mas1')));
}
function lineaCarrito(ctx, l, aj, compacta) {
  const p = ctx.productos[l.sku];
  const g = { titulo: titulo(p), tipo: p.tipo, genero: p.genero, foto: fotoDe(p, ctx.imagenes) };
  const variante = [p.color, p.talla && `Talla ${p.talla}`].filter(Boolean).join(' · ') || p.sku;
  const alternar = () => { const c = carrito(ctx); c.abierta = c.abierta === l.sku ? null : l.sku; window.dispatchEvent(new CustomEvent('pos:carrito')); };
  if (compacta) return h('div', { class: 'linea mini', 'data-sku': l.sku, role: 'button', tabindex: '0', 'aria-expanded': 'false', onclick: alternar, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } } },
    h('span', { class: 'lc-q num' }, String(l.cantidad)),
    h('span', { class: 'lc-t' }, h('b', {}, g.titulo), h('small', {}, ` · ${variante}`)),
    h('span', { class: 'lc-monto' }, h('span', { class: 'num monto' }, fmtCop(l.subtotal))),
    icono('abajo'));
  const plegable = carrito(ctx).lineas.length > MAX_ABIERTAS;
  return h('div', { class: 'linea' + (plegable ? ' abierta' : ''), 'data-sku': l.sku, onclick: plegable ? alternar : null, 'aria-expanded': plegable ? 'true' : null },
    miniatura(g, 'foto'),
    h('div', { class: 'linea-info' },
      h('b', {}, g.titulo),
      h('span', { class: 'lc-chip' }, variante),
      h('span', { class: 'lc-chip tramo' + (l.oferta ? ' oferta' : '') }, l.oferta ? 'Precio de oferta' : `Tarifa ${etiquetaTramo(l.tramo, aj.tramos)}`)),
    h('div', { class: 'linea-der' },
      contador(ctx, l),
      h('span', { class: 'lc-pie' },
        h('span', { class: 'lc-monto' }, h('span', { class: 'num monto' }, fmtCop(l.subtotal)), h('span', { class: 'c-cop moneda' }, 'COP')),
        l.cantidad > 1 ? h('span', { class: 'nota num lc-cu' }, `${fmtCop(l.precioUnit)} c/u`) : null)));
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
  cont.replaceChildren(nuevo);
  if (!habia) return;
  cont.querySelectorAll('.linea[data-sku]').forEach(el => {
    const a = antes.get(el.dataset.sku), h1 = el.getBoundingClientRect().height, h0 = a ? a.h : 0;
    if (Math.abs(h1 - h0) < 2) return;
    el.style.overflow = 'hidden';
    const an = el.animate(a ? [{ height: `${h0}px` }, { height: `${h1}px` }] : [{ height: '0px', opacity: 0 }, { height: `${h1}px`, opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.22,.9,.3,1)' });
    if (!el.classList.contains('mini') && (!a || a.mini)) [...el.children].forEach((c, k) => c.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: 40 + k * 35, easing: 'ease-out', fill: 'backwards' }));
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
      { duration: 480, easing: 'cubic-bezier(.4,0,.2,1)' });
    an.onfinish = () => { aviso.style.overflow = ''; aviso.classList.add('anim'); };
    an.oncancel = () => { aviso.style.overflow = ''; };
  } else if (aviso && aviso.textContent !== avisoAntes) {
    // Cambió el número: el texto se renueva con un fundido corto y el aviso late.
    aviso.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    aviso.classList.add('anim');
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
        { duration: 380, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => fantasma.remove();
    }
  }
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
    r.aviso ? h('div', { class: 'aviso aviso-tramo' }, icono('etiqueta'), `Con ${r.aviso.faltan} ${r.aviso.faltan === 1 ? 'prenda' : 'prendas'} más pasan a precio ${r.aviso.etiqueta}`) : null,
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
      h('button', { class: 'btn', id: 'car-descuento', onclick: () => abrirDescuento(ctx) }, icono('etiqueta'), 'Descuento'),
      h('button', { class: 'btn', onclick: () => ctx.abrirCobro && ctx.abrirCobro('apartar') }, icono('apartado'), 'Apartar'),
      h('button', { class: 'btn primary cobrar', onclick: () => ctx.abrirCobro && ctx.abrirCobro('venta') }, 'Cobrar')));
}

// Descuento por monto, en pesos o en dólares (sin porcentaje). En dólares se convierte a pesos con la tasa del día.
// Si ya hay uno, la misma ventana permite quitarlo.
function abrirDescuento(ctx) {
  const c = carrito(ctx);
  const r = resumenCarrito(ctx);
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
  const nota = ctx.rol() === 'vendedora' ? h('p', { class: 'nota' }, 'El descuento se aplica cuando lo autorice el administrador o la encargada.') : null;
  const aplicar = h('button', { class: 'btn primary' }, 'Aplicar');
  const quitarDesc = c.descuento ? h('button', { type: 'button', class: 'btn texto peligro', id: 'desc-quitar', onclick: () => { c.descuento = null; c.autorizacion = null; v.cerrar(); toast('Descuento quitado'); window.dispatchEvent(new CustomEvent('pos:carrito')); } }, 'Quitar descuento') : null;
  const v = abrirVentana({ titulo: 'Descuento', contenido: h('div', { class: 'pila' }, segm,
    h('div', { class: 'campo' }, h('label', { for: 'desc-valor' }, 'Monto a descontar'), h('div', { class: 'desc-entrada' }, valor, sufijo), equiv, err), nota),
    acciones: h('div', { class: 'acciones' }, quitarDesc, aplicar) });
  pintar();
  aplicar.addEventListener('click', async () => {
    const n = enPesos();
    if (!n) { err.textContent = 'Escribe un monto'; return; }
    const pct = r.subtotal ? n * 100 / r.subtotal : 100;
    if (pct >= 100) { err.textContent = 'Debe ser menor que el total'; return; }
    const tipo = 'monto';
    const desc = { tipo, valor: n, moneda, valorUsd: moneda === 'USD' ? parseMonto(valor.value, 'USD') : null };
    if (requiereAutorizacion(ctx.rol(), pct, max)) {
      aplicar.disabled = true;
      const s = await ctx.almacen.solicitarAutorizacion({ pct: Math.round(pct * 100) / 100, tipo, valor: n, subtotal: r.subtotal });
      if (!s.ok) { aplicar.disabled = false; err.textContent = s.error === 'red' ? 'Necesitas internet para pedir autorización' : 'No se pudo pedir'; return; }
      err.textContent = '';
      aplicar.textContent = 'Esperando autorización…';
      const quitar = ctx.almacen.escuchar('autorizaciones', lista => {
        const a = lista.find(x => x.id === s.id);
        if (!a || a.estado === 'pendiente') return;
        setTimeout(() => quitar && quitar());
        if (a.estado === 'aprobada') { c.descuento = desc; c.autorizacion = { id: a.id, por: a.aprueba, subtotal: r.subtotal }; v.cerrar(); toast('Descuento autorizado'); window.dispatchEvent(new CustomEvent('pos:carrito')); }
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
        h('span', { class: 'tf-disp' + (pocas ? ' pocas' : '') }, agotada ? 'Agotada' : [`${p.existencia} `, h('span', { class: 'largo' }, p.existencia === 1 ? 'disponible' : 'disponibles'), h('span', { class: 'corto' }, 'disp.')]),
        h('span', { class: 'tf-paso' },
          h('button', { type: 'button', class: 'talla-menos', 'data-sku': p.sku, 'aria-label': `Quitar una talla ${nombre}`, disabled: !n,
            onclick: () => { cuentas[p.sku] = Math.max(0, n - 1); pintar(); } }, icono('menos')),
          h('span', { class: 'tf-cant num' + (n ? ' con' : ''), 'aria-live': 'polite' }, String(n)),
          h('button', { type: 'button', class: 'talla-mas', 'data-talla': nombre, 'data-sku': p.sku, 'aria-label': `Agregar una talla ${nombre}`, disabled: agotada || n >= p.existencia,
            onclick: () => { if (n >= p.existencia) return; cuentas[p.sku] = n + 1; pintar(); } }, icono('mas1'))),
        !agotada && n > 0 && n >= p.existencia ? h('span', { class: 'tf-max' }, `Máximo ${p.existencia}`) : null);
    }));
    const total = Object.values(cuentas).reduce((x, y) => x + y, 0);
    const cambio = variantes.some(p => cuentas[p.sku] !== antes[p.sku]);
    const habia = Object.values(antes).some(Boolean);
    agregar.replaceChildren(icono('carrito'), habia ? 'Actualizar carrito' : 'Agregar al carrito', ...(total ? [h('span', { class: 'tf-total' }, ` · ${total}`)] : []));
    agregar.disabled = !cambio;
  };
  pintar();
  const cont = h('div', { class: 'tallas-v' },
    h('p', { class: 'tallas-sub' }, g.color ? h('i', { class: 'punto-color grande', style: color ? `--pc:${color}` : '' }) : null, [g.color, 'Selecciona las tallas'].filter(Boolean).join(' · ')),
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

// Fila de prenda: imagen cuadrada, nombre, color y tallas; a la derecha disponibles y precio.
function tarjeta(ctx, g) {
  const existencia = g.variantes.reduce((s, p) => s + Math.max(p.existencia, 0), 0);
  const agotada = existencia <= 0;
  const pocas = !agotada && g.variantes.some(p => p.existencia > 0 && p.existencia <= p.minimo);
  const precio = Math.min(...g.variantes.map(p => p.precios?.[0] || Infinity));
  const oferta = g.variantes.some(p => p.oferta?.activa);
  const elegidas = g.variantes.reduce((s, p) => s + enCarrito(ctx, p.sku), 0);
  const tallas = [...g.variantes].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || compararTallas(a.talla, b.talla));
  const color = colorPrenda(g.color);
  return h('button', { class: 'tarjeta-prenda' + (agotada ? ' agotada' : '') + (elegidas ? ' elegida' : ''), 'data-grupo': g.grupo, 'data-nombre': [g.titulo, g.color].filter(Boolean).join(' '), onclick: () => (ctx.miCaja || !ctx.puedeVer('cajaFisica') ? abrirTallas(ctx, g) : abrirCajaVentana(ctx)) },
    h('span', { class: 'tp-img' }, miniatura(g, 'foto'), elegidas ? h('span', { class: 'en-carrito', 'aria-label': `${elegidas} en el carrito` }, String(elegidas)) : null),
    h('span', { class: 'info' },
      h('b', {}, g.titulo),
      h('span', { class: 'tp-linea' },
        g.color ? h('span', { class: 'tp-color' }, h('i', { class: 'punto-color', style: color ? `--pc:${color}` : '' }), g.color) : null,
        h('span', { class: 'tp-tallas' }, h('span', { class: 'tp-pal' }, 'Tallas: '), ...tallas.slice(0, 5).flatMap((p, i) => [i ? ' · ' : '', h('span', { class: p.existencia > 0 ? '' : 'sin' }, p.talla || 'Única')]),
          // Con muchas tallas, las 5 primeras y «+N»: la fila nunca se parte en dos líneas.
          tallas.length > 5 ? h('span', { class: 'tp-mas', 'aria-label': `y ${tallas.length - 5} tallas más` }, ` +${tallas.length - 5}`) : null))),
    h('span', { class: 'tp-der' },
      agotada ? h('span', { class: 'est r tp-estado' }, icono('alerta'), 'Agotada')
        : h('span', { class: 'est tp-disp ' + (pocas ? 'y' : 'g') }, `${existencia} disp.`),
      agotada ? null : h('span', { class: 'num precio' }, Number.isFinite(precio) ? fmtCop(precio) : '—'),
      !agotada && oferta ? h('span', { class: 'tp-estado tp-oferta' }, 'oferta') : null));
}

registrarVista('/vender', {
  montar(cont, ctx) {
    let busqueda = '', genero = '';
    const buscar = h('input', { class: 'inp', id: 'buscar', type: 'search', 'aria-label': 'Buscar prenda o código', placeholder: 'Buscar prenda o código', autocomplete: 'off', enterkeyhint: 'search' });
    const filtros = h('div', { class: 'filtros' });
    const rejilla = h('div', { class: 'rejilla' });
    const lado = h('aside', { class: 'lado-carrito' });
    const barra = h('button', { class: 'barra-carrito', onclick: () => {
      const hj = abrirHoja({ titulo: 'Carrito', contenido: h('div', { class: 'hoja-carrito' }), lado: 'abajo' });
      const repintar = () => { ponerCarrito(hj.el.querySelector('.hoja-carrito'), panelCarrito(ctx, { enHoja: true })); if (!carrito(ctx).lineas.length) hj.cerrar(); };
      repintar();
      window.addEventListener('pos:carrito', repintar);
      hj.alCerrar = () => window.removeEventListener('pos:carrito', repintar);
    } });
    const sinCaja = h('div', { class: 'aviso sin-caja' }, icono('cartera'), h('span', {}, 'Abre tu caja para vender'), h('span', { class: 'sp' }), h('button', { class: 'btn primary', onclick: () => abrirCajaVentana(ctx) }, 'Abrir caja'));

    const escanear = ('BarcodeDetector' in window)
      ? h('button', { class: 'btn', 'aria-label': 'Escanear', onclick: () => ctx.escanear && ctx.escanear(cod => agregarPorCodigo(cod)) }, icono('escanear'), h('span', { class: 'solo-pc' }, 'Escanear'))
      : h('button', { class: 'btn solo-pc', 'aria-label': 'Escanear', onclick: () => { buscar.focus(); toast('Escanea con el lector'); } }, icono('escanear'), 'Escanear');

    function agregarPorCodigo(cod) {
      const p = Object.values(ctx.productos).find(x => x.codigo && x.codigo === cod.trim());
      if (!p) return false;
      if (agregarAlCarrito(ctx, p.sku, 1)) toast(`${titulo(p)} ${p.talla ? 'T' + p.talla : ''} agregada`);
      return true;
    }

    function pintar() {
      const todos = grupos(ctx);
      const generos = [...new Set(todos.map(g => g.genero).filter(Boolean))].sort();
      filtros.replaceChildren(...['', ...generos].map(c => h('button', { class: 'chip' + (c === genero ? ' activo' : ''), onclick: () => { genero = c; pintar(); } }, c || 'Todo')));
      const q = norm(busqueda);
      const vis = todos.filter(g => (!genero || g.genero === genero) && (!q || g.variantes.some(p => norm(textoBusqueda(p)).includes(q))));
      rejilla.replaceChildren(...(vis.length ? vis.map(g => tarjeta(ctx, g)) : [h('div', { class: 'vacio' }, q ? 'No hay prendas con esa búsqueda' : 'Todavía no hay productos. El administrador los importa desde la Carga Masiva.')]));
      pintarCarrito();
    }
    function pintarCarrito() {
      const porGrupo = new Map(grupos(ctx).map(g => [g.grupo, g]));
      rejilla.querySelectorAll('.tarjeta-prenda').forEach(el => { const g = porGrupo.get(el.dataset.grupo); if (g) el.replaceWith(tarjeta(ctx, g)); });
      ponerCarrito(lado, panelCarrito(ctx));
      const r = resumenCarrito(ctx);
      barra.hidden = !r.unidades;
      barra.replaceChildren(h('span', {}, `${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`), h('span', { class: 'num' }, `${fmtCop(r.total)} · Ver`));
      sinCaja.hidden = !!ctx.miCaja || !ctx.puedeVer('cajaFisica');
    }
    buscar.addEventListener('input', () => { busqueda = buscar.value; pintar(); });
    buscar.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (agregarPorCodigo(buscar.value)) { buscar.value = ''; busqueda = ''; pintar(); }
      else buscar.blur();
    });
    const teclas = e => {
      if (e.key === 'F2') { e.preventDefault(); buscar.focus(); buscar.select(); }
      if (e.key === 'F9' && carrito(ctx).lineas.length && !hayCapas()) { e.preventDefault(); ctx.abrirCobro && ctx.abrirCobro('venta'); }
    };
    const alDatos = e => { if (['productos', 'ajustes', 'tasas', 'caja'].includes(e.detail.que)) pintar(); };
    document.addEventListener('keydown', teclas);
    window.addEventListener('pos:datos', alDatos);
    window.addEventListener('pos:carrito', pintarCarrito);

    cont.classList.add('vender');
    cont.append(h('div', { class: 'vender-main' }, sinCaja, h('div', { class: 'buscador' }, h('div', { class: 'buscar-caja' }, icono('buscar'), buscar), escanear), filtros, rejilla), lado, barra);
    pintar();
    if (!esTelefono()) setTimeout(() => buscar.focus(), 50);
    return () => { document.removeEventListener('keydown', teclas); window.removeEventListener('pos:datos', alDatos); window.removeEventListener('pos:carrito', pintarCarrito); };
  },
});
