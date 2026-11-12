// Pantalla Vender (§8): tarjetas por modelo y color, tallas, carrito con tramos, descuento y atajos.
import { h, icono, abrirVentana, abrirHoja, toast, esTelefono } from '../ui.js';
import { registrarVista, navegar } from '../app.js';
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
  window.dispatchEvent(new CustomEvent('pos:carrito'));
  return true;
}

function grupos(ctx) {
  const g = {};
  for (const p of Object.values(ctx.productos)) {
    if (p.activo === false) continue;
    const k = p.grupo || p.sku;
    (g[k] ||= { grupo: k, producto: p.producto || p.nombre, color: p.color, categoria: p.categoria, foto: p.foto, variantes: [] }).variantes.push(p);
  }
  return Object.values(g).sort((a, b) => a.grupo.localeCompare(b.grupo, 'es'));
}

function lineaCarrito(ctx, l, aj) {
  const p = ctx.productos[l.sku];
  return h('div', { class: 'linea', 'data-sku': l.sku },
    h('div', { class: 'linea-info' },
      h('b', {}, p.producto || p.nombre),
      h('div', { class: 'nota' }, [p.color, p.talla && `Talla ${p.talla}`].filter(Boolean).join(' · ')),
      h('div', { class: 'tramo' + (l.oferta ? ' oferta' : '') }, `precio ${etiquetaTramo(l.tramo, aj.tramos)}`, l.oferta ? ' · oferta' : '', ' · ', h('span', { class: 'num' }, fmtCop(l.precioUnit)))),
    h('div', { class: 'linea-der' },
      h('span', { class: 'num monto' }, fmtCop(l.subtotal)),
      h('div', { class: 'stepper' },
        h('button', { 'aria-label': 'Menos', onclick: () => agregarAlCarrito(ctx, l.sku, -1) }, icono('menos')),
        h('span', { class: 'cant num' }, String(l.cantidad)),
        h('button', { 'aria-label': 'Más', onclick: () => agregarAlCarrito(ctx, l.sku, 1) }, icono('mas1')),
        h('button', { 'aria-label': 'Quitar', class: 'quitar', onclick: () => agregarAlCarrito(ctx, l.sku, -l.cantidad) }, icono('borrar')))));
}

function equivalentes(ctx, cop) {
  const usd = desdeCop(cop, 'USD', ctx.tasas), bs = desdeCop(cop, 'BS', ctx.tasas);
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
    h('div', { class: 'lineas' }, r.lineas.map(l => lineaCarrito(ctx, l, aj))),
    r.aviso ? h('div', { class: 'aviso aviso-tramo' }, icono('etiqueta'), `Con ${r.aviso.faltan} ${r.aviso.faltan === 1 ? 'prenda' : 'prendas'} más pasan a precio ${r.aviso.etiqueta}`) : null,
    h('div', { class: 'totales' },
      r.descuento ? h('div', { class: 'fila-total' }, h('span', {}, 'Subtotal'), h('span', { class: 'num' }, fmtCop(r.subtotal))) : null,
      r.descuento ? h('div', { class: 'fila-total desc' }, h('span', {}, 'Descuento'), h('span', { class: 'num' }, '-' + fmtCop(r.descuento)),
        h('button', { class: 'ibtn chico', 'aria-label': 'Quitar descuento', onclick: () => { c.descuento = null; c.autorizacion = null; window.dispatchEvent(new CustomEvent('pos:carrito')); } }, icono('x'))) : null,
      h('div', { class: 'et-total' }, 'TOTAL'),
      h('div', { class: 'total' }, h('span', { class: 'total-cop num' }, fmtCop(r.total)), h('span', { class: 'c-cop moneda' }, 'COP')),
      equivalentes(ctx, r.total)),
    h('div', { class: 'acciones-carrito' },
      h('button', { class: 'btn', onclick: () => abrirDescuento(ctx) }, icono('porcentaje'), 'Descuento'),
      h('button', { class: 'btn', onclick: () => ctx.abrirCobro && ctx.abrirCobro('apartar') }, icono('apartado'), 'Apartar'),
      h('button', { class: 'btn primary cobrar', onclick: () => ctx.abrirCobro && ctx.abrirCobro('venta') }, 'Cobrar')));
}

function abrirDescuento(ctx) {
  const c = carrito(ctx);
  const r = resumenCarrito(ctx);
  const max = ctx.ajustes.descuentoMaxVendedora;
  let tipo = c.descuento?.tipo || 'pct';
  const valor = h('input', { class: 'inp', id: 'desc-valor', inputmode: 'decimal', value: c.descuento?.valor ?? '' });
  const err = h('span', { class: 'error' });
  const segm = h('div', { class: 'segmentado' },
    ...[['pct', '%'], ['monto', 'Monto COP']].map(([t, txt]) => h('button', { type: 'button', 'aria-pressed': String(t === tipo), onclick: e => { tipo = t; segm.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, txt)));
  const nota = ctx.sesion.rol === 'vendedora' ? h('p', { class: 'nota' }, `Puedes dar hasta ${max}% sin autorización.`) : null;
  const aplicar = h('button', { class: 'btn primary' }, 'Aplicar');
  const v = abrirVentana({ titulo: 'Descuento', contenido: h('div', { class: 'pila' }, segm, h('div', { class: 'campo' }, h('label', { for: 'desc-valor' }, 'Valor'), valor, err), nota), acciones: h('div', { class: 'acciones' }, aplicar) });
  aplicar.addEventListener('click', async () => {
    const n = parseMonto(valor.value, tipo === 'pct' ? 'USD' : 'COP');
    if (!n || n <= 0) { err.textContent = 'Escribe un valor'; return; }
    const pct = tipo === 'pct' ? n : (r.subtotal ? n * 100 / r.subtotal : 0);
    if (pct > 100) { err.textContent = 'No puede ser mayor que el total'; return; }
    if (requiereAutorizacion(ctx.sesion.rol, pct, max)) {
      aplicar.disabled = true;
      const s = await ctx.almacen.solicitarAutorizacion({ pct: Math.round(pct * 100) / 100, tipo, valor: n, subtotal: r.subtotal });
      if (!s.ok) { aplicar.disabled = false; err.textContent = s.error === 'red' ? 'Necesitas internet para pedir autorización' : 'No se pudo pedir'; return; }
      err.textContent = '';
      aplicar.textContent = 'Esperando autorización…';
      const quitar = ctx.almacen.escuchar('autorizaciones', lista => {
        const a = lista.find(x => x.id === s.id);
        if (!a || a.estado === 'pendiente') return;
        setTimeout(() => quitar && quitar());
        if (a.estado === 'aprobada') { c.descuento = { tipo, valor: n }; c.autorizacion = { id: a.id, por: a.aprueba }; v.cerrar(); toast('Descuento autorizado'); window.dispatchEvent(new CustomEvent('pos:carrito')); }
        else { aplicar.disabled = false; aplicar.textContent = 'Aplicar'; err.textContent = 'Descuento rechazado'; }
      });
      v.alCerrar = () => quitar && quitar();
      return;
    }
    c.descuento = { tipo, valor: n }; c.autorizacion = null;
    v.cerrar(); window.dispatchEvent(new CustomEvent('pos:carrito'));
  });
}

function abrirTallas(ctx, g) {
  const cont = h('div', { class: 'tallas' });
  const pintar = () => cont.replaceChildren(...g.variantes.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map(p => {
    const disp = p.existencia - enCarrito(ctx, p.sku);
    const en = enCarrito(ctx, p.sku);
    return h('button', { class: 'talla' + (p.existencia <= p.minimo && p.existencia > 0 ? ' pocas' : ''), 'data-talla': p.talla || p.sku, 'data-sku': p.sku, disabled: p.existencia <= 0,
      onclick: () => { if (disp <= 0) { toast('No hay más existencia'); return; } agregarAlCarrito(ctx, p.sku, 1); pintar(); } },
    h('b', {}, p.talla || p.nombre), h('span', { class: 'nota' }, p.existencia <= 0 ? 'Agotada' : `${p.existencia} disp.`), en ? h('span', { class: 'en-carrito' }, String(en)) : null);
  }));
  pintar();
  abrirVentana({ titulo: `${g.producto}${g.color ? ' · ' + g.color : ''}`, contenido: cont });
}

function tarjeta(ctx, g) {
  const existencia = g.variantes.reduce((s, p) => s + Math.max(p.existencia, 0), 0);
  const agotada = existencia <= 0;
  const pocas = !agotada && g.variantes.some(p => p.existencia > 0 && p.existencia <= p.minimo);
  const precio = Math.min(...g.variantes.map(p => p.precios?.[0] || Infinity));
  const oferta = g.variantes.some(p => p.oferta?.activa);
  return h('button', { class: 'tarjeta-prenda' + (agotada ? ' agotada' : ''), 'data-grupo': g.grupo, onclick: () => abrirTallas(ctx, g) },
    h('div', { class: 'foto' }, g.foto ? h('img', { src: g.foto, alt: '', loading: 'lazy' }) : icono('franela')),
    h('div', { class: 'info' },
      h('b', {}, g.producto),
      h('div', { class: 'nota' }, [g.color, `${g.variantes.length} ${g.variantes.length === 1 ? 'talla' : 'tallas'}`].filter(Boolean).join(' · '), pocas ? h('span', { class: 'pocas' }, ' · pocas') : null),
      h('div', { class: 'precio-fila' }, h('span', { class: 'num precio' }, Number.isFinite(precio) ? fmtCop(precio) : '—'),
        agotada ? h('span', { class: 'est r' }, 'Agotada') : oferta ? h('span', { class: 'est y' }, 'Oferta') : null)));
}

registrarVista('/vender', {
  montar(cont, ctx) {
    let busqueda = '', categoria = '';
    const buscar = h('input', { class: 'inp', id: 'buscar', type: 'search', placeholder: 'Buscar prenda o código', autocomplete: 'off', enterkeyhint: 'search' });
    const filtros = h('div', { class: 'filtros' });
    const rejilla = h('div', { class: 'rejilla' });
    const lado = h('aside', { class: 'lado-carrito' });
    const barra = h('button', { class: 'barra-carrito', onclick: () => {
      const hj = abrirHoja({ titulo: 'Carrito', contenido: h('div', { class: 'hoja-carrito' }), lado: 'abajo' });
      const repintar = () => { hj.el.querySelector('.hoja-carrito').replaceChildren(panelCarrito(ctx, { enHoja: true })); if (!carrito(ctx).lineas.length) hj.cerrar(); };
      repintar();
      window.addEventListener('pos:carrito', repintar);
      hj.alCerrar = () => window.removeEventListener('pos:carrito', repintar);
    } });
    const sinCaja = h('div', { class: 'aviso sin-caja' }, icono('cartera'), h('span', {}, 'Abre tu caja para vender'), h('span', { class: 'sp' }), h('button', { class: 'btn primary', onclick: () => navegar('/caja') }, 'Abrir caja'));

    const escanear = ('BarcodeDetector' in window)
      ? h('button', { class: 'btn', 'aria-label': 'Escanear', onclick: () => ctx.escanear && ctx.escanear(cod => agregarPorCodigo(cod)) }, icono('escanear'), h('span', { class: 'solo-pc' }, 'Escanear'))
      : h('button', { class: 'btn solo-pc', 'aria-label': 'Escanear', onclick: () => { buscar.focus(); toast('Escanea con el lector'); } }, icono('escanear'), 'Escanear');

    function agregarPorCodigo(cod) {
      const p = Object.values(ctx.productos).find(x => x.codigo && x.codigo === cod.trim());
      if (!p) return false;
      if (agregarAlCarrito(ctx, p.sku, 1)) toast(`${p.producto || p.nombre} ${p.talla ? 'T' + p.talla : ''} agregada`);
      return true;
    }

    function pintar() {
      const todos = grupos(ctx);
      const cats = [...new Set(todos.map(g => g.categoria).filter(Boolean))].sort();
      filtros.replaceChildren(...['', ...cats].map(c => h('button', { class: 'chip' + (c === categoria ? ' activo' : ''), onclick: () => { categoria = c; pintar(); } }, c || 'Todo')));
      const q = norm(busqueda);
      const vis = todos.filter(g => (!categoria || g.categoria === categoria) && (!q || g.variantes.some(p => norm(`${p.grupo} ${p.nombre} ${p.sku} ${p.codigo} ${p.marca}`).includes(q))));
      rejilla.replaceChildren(...(vis.length ? vis.map(g => tarjeta(ctx, g)) : [h('div', { class: 'vacio' }, q ? 'No hay prendas con esa búsqueda' : 'Todavía no hay productos. El administrador los importa desde la Carga Masiva.')]));
      pintarCarrito();
    }
    function pintarCarrito() {
      lado.replaceChildren(panelCarrito(ctx));
      const r = resumenCarrito(ctx);
      barra.hidden = !r.unidades;
      barra.replaceChildren(h('span', {}, `${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`), h('span', { class: 'num' }, `${fmtCop(r.total)} · Ver`));
      sinCaja.hidden = !!ctx.miCaja;
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
      if (e.key === 'F9' && carrito(ctx).lineas.length) { e.preventDefault(); ctx.abrirCobro && ctx.abrirCobro('venta'); }
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
